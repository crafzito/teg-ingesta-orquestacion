import csv
import logging
from pathlib import Path

from etl.constants import CATALOG_DOMAINS
from etl.transform.parsers import normalize_text_upper

logger = logging.getLogger(__name__)

ENRICHMENT_COLUMNS = [
    "cod_gpo_cliente", "cod_clase_doc", "cod_sector", "cod_canal",
    "cod_zona_ventas", "cod_doc_comercial", "cod_grp_vend", "cod_ramo",
    "cod_gr_material", "cod_gr_articulo", "cod_lista_precio", "cod_tx_motivo",
    "cod_cliente_fk", "codigo_mat_fk", "cod_vendedor_fk", "cod_condicion_pago_fk", "cod_moneda_fk",
    "dim_cliente_id", "dim_producto_id", "dim_vendedor_id", "dim_condicion_pago_id", "dim_moneda_id",
    "dim_gpo_cliente_id", "dim_clase_doc_id", "dim_sector_id", "dim_canal_id",
    "dim_zona_ventas_id", "dim_doc_comercial_id", "dim_grp_vend_id", "dim_ramo_id",
    "dim_gr_material_id", "dim_gr_articulo_id", "dim_lista_precio_id", "dim_tx_motivo_id",
    "batch_id", "line_hash", "quality_flags",
]

# Mapeo dominio -> indice de columna en el CSV original de ventas
_DOMAIN_TO_CSV_INDEX = {
    "gpo_cliente":   1,
    "clase_doc":     2,
    "sector":        4,
    "canal":         5,
    "zona_ventas":   7,
    "doc_comercial": 18,
    "grp_vend":      24,
    "ramo":          35,
    "gr_material":   36,
    "gr_articulo":   37,
    "lista_precio":  47,
    "tx_motivo":     55,
}

_CSV_IDX_CODIGO_MAT = 46
_CSV_IDX_COD_CLIENTE = 49
_CSV_IDX_MONEDA_DOC = 21
_CSV_IDX_COND_PAGO = 19
_CSV_IDX_COD_VEND = 56
_CSV_DOMAIN_ORDER = [
    "gpo_cliente", "clase_doc", "sector", "canal",
    "zona_ventas", "doc_comercial", "grp_vend", "ramo",
    "gr_material", "gr_articulo", "lista_precio", "tx_motivo",
]


def _lookup_dim_ids(conn, table: str, key_col: str, id_col: str) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT {key_col}, {id_col} FROM core.{table}")
        out = {}
        for key, dim_id in cur.fetchall():
            if key is None:
                continue
            out[str(key).strip()] = dim_id
        return out


def _empty_if_none(value):
    return "" if value is None else value


def enrich_csv(conn, input_path: str, output_path: str, batch_id: str,
               ventas_clean: list[dict] | None = None) -> int:
    # Cargar mapa dominio -> valor_normalizado -> codigo
    val_to_code: dict[str, dict[str, str]] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT dominio, valor_normalizado, codigo_generado FROM core.map_catalogo_valor")
        for dominio, val_norm, codigo in cur.fetchall():
            if dominio not in val_to_code:
                val_to_code[dominio] = {}
            val_to_code[dominio][val_norm] = codigo

    # Lookups a IDs de dimensiones base
    cliente_lk = _lookup_dim_ids(conn, "dim_cliente", "cod_cliente", "dim_cliente_id")
    producto_lk = _lookup_dim_ids(conn, "dim_producto", "codigo_mat", "dim_producto_id")
    vendedor_lk = _lookup_dim_ids(conn, "dim_vendedor", "cod_vendedor", "dim_vendedor_id")
    condpago_lk = _lookup_dim_ids(conn, "dim_condicion_pago", "cod_condicion_pago", "dim_condicion_pago_id")
    moneda_lk = _lookup_dim_ids(conn, "dim_moneda", "cod_moneda", "dim_moneda_id")

    # Lookups a IDs para catalogos (por codigo)
    catalog_id_lk: dict[str, dict[str, int]] = {}
    for domain, info in CATALOG_DOMAINS.items():
        table = info["table"]
        id_col = f"{table}_id"
        catalog_id_lk[domain] = _lookup_dim_ids(conn, table, "codigo", id_col)

    # Construir mapa row_number -> dict para alinear correctamente
    # CSVReader usa enumerate(reader, start=1), enrich usa enumerate(reader) 0-based tras header
    # Entonces: row_idx 0 en enrich = row_number 1 en CSVReader
    clean_by_row: dict[int, dict] = {}
    if ventas_clean:
        for vd in ventas_clean:
            rn = vd.get("_row_number")
            if rn is not None:
                clean_by_row[rn] = vd

    count = 0
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(input_path, "r", encoding="utf-8", newline="") as fin, \
         open(output_path, "w", encoding="utf-8", newline="") as fout:

        reader = csv.reader(fin)
        writer = csv.writer(fout)

        header = next(reader)
        writer.writerow(header + ENRICHMENT_COLUMNS)

        for row_idx, row in enumerate(reader):
            enriched = []
            domain_codes: dict[str, str] = {}

            for domain in _CSV_DOMAIN_ORDER:
                col_idx = _DOMAIN_TO_CSV_INDEX[domain]
                raw_val = row[col_idx].strip() if col_idx < len(row) else ""
                norm = normalize_text_upper(raw_val) if raw_val else "UNKNOWN"
                code = val_to_code.get(domain, {}).get(norm, "")
                domain_codes[domain] = code
                enriched.append(code)

            # Codigos base para FKs principales
            cod_cliente = row[_CSV_IDX_COD_CLIENTE].strip() if _CSV_IDX_COD_CLIENTE < len(row) else ""
            codigo_mat = row[_CSV_IDX_CODIGO_MAT].strip() if _CSV_IDX_CODIGO_MAT < len(row) else ""
            cod_vend = row[_CSV_IDX_COD_VEND].strip() if _CSV_IDX_COD_VEND < len(row) else ""
            cond_pago_raw = row[_CSV_IDX_COND_PAGO].strip() if _CSV_IDX_COND_PAGO < len(row) else ""
            cond_pago_norm = normalize_text_upper(cond_pago_raw) if cond_pago_raw else "UNKNOWN"
            cod_cond_pago = val_to_code.get("condicion_pago", {}).get(cond_pago_norm)
            if not cod_cond_pago and cond_pago_norm != "UNKNOWN":
                cod_cond_pago = cond_pago_norm
            moneda_doc = row[_CSV_IDX_MONEDA_DOC].strip() if _CSV_IDX_MONEDA_DOC < len(row) else ""

            enriched.extend([
                cod_cliente,
                codigo_mat,
                cod_vend,
                cod_cond_pago or "",
                moneda_doc,
            ])

            # IDs de todas las dimensiones relacionadas al fact
            dim_values = [
                cliente_lk.get(cod_cliente),
                producto_lk.get(codigo_mat),
                vendedor_lk.get(cod_vend),
                condpago_lk.get(cod_cond_pago) if cod_cond_pago else None,
                moneda_lk.get(moneda_doc),
                catalog_id_lk["gpo_cliente"].get(domain_codes.get("gpo_cliente", "")),
                catalog_id_lk["clase_doc"].get(domain_codes.get("clase_doc", "")),
                catalog_id_lk["sector"].get(domain_codes.get("sector", "")),
                catalog_id_lk["canal"].get(domain_codes.get("canal", "")),
                catalog_id_lk["zona_ventas"].get(domain_codes.get("zona_ventas", "")),
                catalog_id_lk["doc_comercial"].get(domain_codes.get("doc_comercial", "")),
                catalog_id_lk["grp_vend"].get(domain_codes.get("grp_vend", "")),
                catalog_id_lk["ramo"].get(domain_codes.get("ramo", "")),
                catalog_id_lk["gr_material"].get(domain_codes.get("gr_material", "")),
                catalog_id_lk["gr_articulo"].get(domain_codes.get("gr_articulo", "")),
                catalog_id_lk["lista_precio"].get(domain_codes.get("lista_precio", "")),
                catalog_id_lk["tx_motivo"].get(domain_codes.get("tx_motivo", "")),
            ]
            enriched.extend(_empty_if_none(v) for v in dim_values)

            # batch_id
            enriched.append(batch_id)

            # line_hash y quality_flags - alinear por row_number (row_idx+1)
            row_number = row_idx + 1
            clean_row = clean_by_row.get(row_number)
            if clean_row is not None:
                enriched.append(clean_row.get("line_hash", ""))
                flags = []
                if clean_row.get("cod_cliente", "") == "UNKNOWN":
                    flags.append("MISSING_CLIENT")
                enriched.append(";".join(flags) if flags else "")
            else:
                enriched.append("")
                enriched.append("REJECTED")

            writer.writerow(row + enriched)
            count += 1

    logger.info("CSV enriquecido: %d filas escritas en %s", count, output_path)
    return count
