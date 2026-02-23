import hashlib
import logging

from psycopg2.extras import execute_values

from etl.constants import CATALOG_DOMAINS, CLIENTES_CATALOG_PAIRS, UNKNOWN
from etl.transform.parsers import normalize_text_upper

logger = logging.getLogger(__name__)


def generate_mock_code(domain: str, normalized_value: str, prefix: str) -> str:
    if normalized_value == UNKNOWN:
        return f"{prefix}_UNKNOWN"
    payload = f"{domain}|{normalized_value}"
    hash_val = hashlib.md5(payload.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}_{hash_val}".upper()


class CatalogResolver:
    def __init__(self, conn):
        self.conn = conn
        self._cache: dict[str, dict[str, str]] = {}

    def resolve_ventas_catalogs(self, ventas_rows: list[dict], batch_id: str) -> None:
        for domain, info in CATALOG_DOMAINS.items():
            field = info["field"]
            prefix = info["prefix"]
            values_seen: dict[str, str] = {}

            for row in ventas_rows:
                raw_val = row.get(field, "")
                if isinstance(raw_val, str):
                    origen = raw_val.strip() if raw_val.strip() else UNKNOWN
                else:
                    origen = str(raw_val) if raw_val else UNKNOWN
                normalizado = normalize_text_upper(origen)
                if normalizado not in values_seen:
                    values_seen[normalizado] = origen

            self._upsert_catalog_entries(domain, prefix, values_seen, batch_id)

    def resolve_clientes_catalogs(self, clientes_rows: list[dict], batch_id: str) -> None:
        for domain, pair_info in CLIENTES_CATALOG_PAIRS.items():
            code_field = pair_info["code_field"]
            desc_field = pair_info["desc_field"]
            cat_info = CATALOG_DOMAINS.get(domain)
            if not cat_info:
                continue
            prefix = cat_info["prefix"]

            values_seen: dict[str, str] = {}
            official_codes: dict[str, str] = {}

            for row in clientes_rows:
                code_val = row.get(code_field, "")
                desc_val = row.get(desc_field, "")
                if isinstance(desc_val, str):
                    origen = desc_val.strip() if desc_val.strip() else UNKNOWN
                else:
                    origen = str(desc_val) if desc_val else UNKNOWN
                normalizado = normalize_text_upper(origen)

                if normalizado not in values_seen:
                    values_seen[normalizado] = origen

                # Guardar codigo oficial si existe
                if isinstance(code_val, str) and code_val.strip():
                    official_codes[normalizado] = code_val.strip()

            self._upsert_catalog_entries(
                domain, prefix, values_seen, batch_id,
                official_codes=official_codes,
            )

    def resolve_condicion_pago(self, clientes_rows: list[dict], ventas_rows: list[dict], batch_id: str) -> None:
        # Paso 1: Recoger codigos oficiales y descripciones de clientes
        pairs: dict[str, str] = {}
        desc_to_code: dict[str, str] = {}
        for row in clientes_rows:
            code = normalize_text_upper(row.get("cod_condicion_pago", ""))
            desc = row.get("desc_condicion_pago", "")
            if code != UNKNOWN:
                pairs[code] = desc.strip() if isinstance(desc, str) and desc.strip() else code
                if isinstance(desc, str) and desc.strip():
                    desc_to_code[normalize_text_upper(desc)] = code

        # Paso 2: Para ventas, resolver descripciones a codigos oficiales
        unmatched = 0
        for row in ventas_rows:
            desc = row.get("cond_pago", "")
            if isinstance(desc, str) and desc.strip():
                normalizado = normalize_text_upper(desc)
                if normalizado in desc_to_code or normalizado in pairs:
                    continue
                # Valor sin codigo oficial conocido
                pairs[normalizado] = desc.strip()
                unmatched += 1

        if unmatched > 0:
            logger.warning("dim_condicion_pago: %d valores de ventas sin codigo oficial", unmatched)

        # Registrar mapeo desc->code en map_catalogo_valor para resolver FKs en fact_loader
        self._upsert_condpago_catalog(desc_to_code, pairs, batch_id)
        self._upsert_condicion_pago(pairs, batch_id)

    def _upsert_condpago_catalog(self, desc_to_code: dict[str, str],
                                  pairs: dict[str, str], batch_id: str) -> None:
        """Registra en map_catalogo_valor el mapeo descripcion -> codigo para condicion_pago."""
        rows = []
        for desc_norm, code in desc_to_code.items():
            rows.append(("condicion_pago", pairs.get(code, code), desc_norm, code, batch_id))
        for code, desc in pairs.items():
            rows.append(("condicion_pago", desc, code, code, batch_id))
        if rows:
            sql = """
                INSERT INTO core.map_catalogo_valor (dominio, valor_origen, valor_normalizado, codigo_generado, _batch_id)
                VALUES %s
                ON CONFLICT (dominio, valor_normalizado) DO UPDATE SET
                    codigo_generado = EXCLUDED.codigo_generado,
                    valor_origen = EXCLUDED.valor_origen
            """
            with self.conn.cursor() as cur:
                execute_values(cur, sql, rows)

    def resolve_moneda(self, clientes_rows: list[dict], ventas_rows: list[dict], batch_id: str) -> None:
        monedas: set[str] = set()
        for row in clientes_rows:
            val = row.get("cod_moneda", "")
            if isinstance(val, str) and val.strip():
                monedas.add(val.strip())
        for row in ventas_rows:
            val = row.get("moneda_doc", "")
            if isinstance(val, str) and val.strip():
                monedas.add(val.strip())

        self._upsert_moneda(monedas, batch_id)

    def _upsert_catalog_entries(
        self, domain: str, prefix: str,
        values_seen: dict[str, str], batch_id: str,
        official_codes: dict[str, str] | None = None,
    ) -> None:
        if not values_seen:
            return

        official_codes = official_codes or {}
        rows_to_insert = []

        for normalizado, origen in values_seen.items():
            if normalizado in official_codes:
                code = official_codes[normalizado]
            else:
                code = generate_mock_code(domain, normalizado, prefix)
            rows_to_insert.append((domain, origen, normalizado, code, batch_id))

        sql = """
            INSERT INTO core.map_catalogo_valor (dominio, valor_origen, valor_normalizado, codigo_generado, _batch_id)
            VALUES %s
            ON CONFLICT (dominio, valor_normalizado) DO UPDATE SET
                valor_origen = EXCLUDED.valor_origen,
                codigo_generado = EXCLUDED.codigo_generado
        """
        with self.conn.cursor() as cur:
            execute_values(cur, sql, rows_to_insert)

        # Upsert en la tabla dim correspondiente
        cat_info = CATALOG_DOMAINS.get(domain)
        if cat_info:
            table = cat_info["table"]
            dim_rows = []
            for normalizado, origen in values_seen.items():
                if normalizado in official_codes:
                    code = official_codes[normalizado]
                else:
                    code = generate_mock_code(domain, normalizado, prefix)
                es_mock = normalizado not in official_codes
                dim_rows.append((code, origen, normalizado, es_mock, batch_id))

            dim_sql = f"""
                INSERT INTO core.{table} (codigo, valor_origen, valor_normalizado, es_mock, _batch_id)
                VALUES %s
                ON CONFLICT (codigo) DO UPDATE SET
                    valor_origen = EXCLUDED.valor_origen,
                    valor_normalizado = EXCLUDED.valor_normalizado,
                    es_mock = EXCLUDED.es_mock,
                    _updated_at = NOW()
            """
            with self.conn.cursor() as cur:
                execute_values(cur, dim_sql, dim_rows)

        logger.info("Catalogo '%s': %d valores resueltos", domain, len(values_seen))

    def _upsert_condicion_pago(self, pairs: dict[str, str], batch_id: str) -> None:
        if not pairs:
            return
        rows = [(code, desc, batch_id) for code, desc in pairs.items()]
        sql = """
            INSERT INTO core.dim_condicion_pago (cod_condicion_pago, desc_condicion_pago, _batch_id)
            VALUES %s
            ON CONFLICT (cod_condicion_pago) DO UPDATE SET
                desc_condicion_pago = EXCLUDED.desc_condicion_pago,
                _updated_at = NOW()
        """
        with self.conn.cursor() as cur:
            execute_values(cur, sql, rows)
        logger.info("dim_condicion_pago: %d valores", len(pairs))

    def _upsert_moneda(self, monedas: set[str], batch_id: str) -> None:
        if not monedas:
            return
        desc_map = {"VED": "Bolivar Digital", "USD": "Dolar Estadounidense"}
        rows = [(m, desc_map.get(m, m), batch_id) for m in monedas]
        sql = """
            INSERT INTO core.dim_moneda (cod_moneda, desc_moneda, _batch_id)
            VALUES %s
            ON CONFLICT (cod_moneda) DO UPDATE SET
                desc_moneda = EXCLUDED.desc_moneda,
                _updated_at = NOW()
        """
        with self.conn.cursor() as cur:
            execute_values(cur, sql, rows)
        logger.info("dim_moneda: %d valores", len(monedas))

    def get_catalog_code(self, domain: str, normalized_value: str) -> str | None:
        if domain not in self._cache:
            self._load_cache(domain)
        return self._cache.get(domain, {}).get(normalized_value)

    def _load_cache(self, domain: str) -> None:
        sql = "SELECT valor_normalizado, codigo_generado FROM core.map_catalogo_valor WHERE dominio = %s"
        with self.conn.cursor() as cur:
            cur.execute(sql, (domain,))
            self._cache[domain] = {row[0]: row[1] for row in cur.fetchall()}
