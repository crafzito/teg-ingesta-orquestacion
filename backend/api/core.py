import datetime
import decimal
import os
import re
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException
from psycopg2 import pool as pg_pool

from .models import (
    EtlDirectorySummary,
    EtlExecutionItem,
    EtlFileEntry,
    LineageSource,
    LogicalRelation,
    SchemaTable,
    ViewFilter,
)

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
_pool: pg_pool.SimpleConnectionPool | None = None

SAFE_IDENTIFIER = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,62}$")
SAFE_VIEW_NAME = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
ALLOWED_OPERATORS = frozenset({"=", "!=", "<", ">", "<=", ">=", "LIKE", "ILIKE"})
ALLOWED_EXPORT_SCHEMAS = frozenset({"public", "reporting", "fact", "dim", "cat", "raw"})
SYSTEM_PREFIXES = ("v_", "dim_", "cat_", "fact_")
FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|"
    r"COPY|EXECUTE|CALL|DO\s|LOCK|VACUUM)\b",
    re.IGNORECASE,
)
ALLOWED_START = re.compile(r"^\s*(SELECT|WITH|EXPLAIN)\b", re.IGNORECASE)
SQL_COMMENTS = re.compile(r"--[^\n]*\n?", re.MULTILINE)

VIEW_CATEGORIES: dict[str, str] = {
    "v_ventas": "Ventas",
    "v_cxc": "Ctas por Cobrar",
    "v_cxp": "Ctas por Pagar",
    "v_inventario": "Inventario",
    "v_ordenes": "Órdenes",
    "v_pedidos": "Pedidos",
    "dim_sociedad": "Dimensión",
    "dim_centro": "Dimensión",
    "dim_producto": "Dimensión",
    "dim_cliente": "Dimensión",
    "dim_vendedor": "Dimensión",
    "dim_condicion_pago": "Dimensión",
    "dim_tipo_material": "Dimensión",
    "dim_grupo_material": "Dimensión",
}

LOOKER_VIEW_LABELS: dict[str, str] = {
    "v_ventas": "Ventas",
    "v_cxc": "Cuentas por Cobrar",
    "v_cxp": "Cuentas por Pagar",
    "v_inventario": "Inventario",
    "v_ordenes": "Órdenes",
    "v_pedidos": "Pedidos",
}

DEFAULT_SCHEMAS = ["cat", "dim", "fact", "raw", "etl"]
ETL_MONITOR_DIRS = [
    PROJECT_ROOT / "data" / "input",
]


_schema_cache: list[SchemaTable] | None = None


def is_protected(name: str) -> bool:
    return any(name.startswith(prefix) for prefix in SYSTEM_PREFIXES)


def validate_readonly(sql: str) -> str:
    cleaned = sql.strip().rstrip(";").strip()
    if not cleaned:
        raise HTTPException(400, "Query vacia")
    no_comments = SQL_COMMENTS.sub("", cleaned).strip()
    if not no_comments:
        raise HTTPException(400, "Query vacia")
    if not ALLOWED_START.match(no_comments):
        raise HTTPException(400, "Solo se permiten SELECT, WITH y EXPLAIN")
    match = FORBIDDEN.search(no_comments)
    if match:
        raise HTTPException(400, f"Keyword prohibido: {match.group(0).upper()}")
    return cleaned


@contextmanager
def write_conn():
    conn = get_pool().getconn()
    try:
        conn.autocommit = False
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        get_pool().putconn(conn)


@contextmanager
def readonly_conn():
    conn = get_pool().getconn()
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION READ ONLY")
        yield conn
    finally:
        try:
            conn.rollback()
        except Exception:
            pass
        get_pool().putconn(conn)


def get_pool() -> pg_pool.SimpleConnectionPool:
    global _pool
    if _pool is None:
        _pool = pg_pool.SimpleConnectionPool(
            minconn=2,
            maxconn=10,
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            dbname=os.getenv("DB_NAME", "sap_etl"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "postgres"),
        )
    return _pool


def build_view_sql(name: str, base_view: str, filters: list[ViewFilter]) -> str:
    if not SAFE_VIEW_NAME.match(name):
        raise HTTPException(400, f"Nombre de vista inválido: '{name}'")
    parts = base_view.split(".")
    if len(parts) != 2:
        raise HTTPException(400, "base_view debe tener formato 'schema.nombre'")
    base_schema, base_name = parts
    if not SAFE_IDENTIFIER.match(base_schema) or not SAFE_IDENTIFIER.match(base_name):
        raise HTTPException(400, "Nombre de vista base inválido")
    where_clauses = []
    for item in filters:
        if not SAFE_IDENTIFIER.match(item.column):
            raise HTTPException(400, f"Columna inválida: '{item.column}'")
        if item.operator not in ALLOWED_OPERATORS:
            raise HTTPException(400, f"Operador inválido: '{item.operator}'")
        escaped = item.value.replace("'", "''")
        where_clauses.append(f'"{item.column}" {item.operator} \'{escaped}\'')
    sql = f'CREATE OR REPLACE VIEW public."{name}" AS\nSELECT * FROM {base_schema}."{base_name}"'
    if where_clauses:
        sql += "\nWHERE " + "\n  AND ".join(where_clauses)
    return sql


def serialize(value):
    if value is None:
        return None
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, memoryview):
        return bytes(value).hex()
    if isinstance(value, (list, tuple)):
        return [serialize(v) for v in value]
    return value


def get_schema() -> list[SchemaTable]:
    global _schema_cache
    if _schema_cache is not None:
        return _schema_cache
    sql = """
        SELECT t.table_schema, t.table_name, t.table_type
        FROM information_schema.tables t
        WHERE t.table_schema IN ('cat', 'dim', 'fact', 'raw', 'etl')
          AND NOT EXISTS (
              SELECT 1 FROM pg_inherits i
              WHERE i.inhrelid = (t.table_schema || '.' || t.table_name)::regclass
          )
        ORDER BY t.table_schema, t.table_name
    """
    with readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            _schema_cache = [
                SchemaTable(
                    schema_name=row[0],
                    table_name=row[1],
                    table_type="view" if row[2] == "VIEW" else "table",
                )
                for row in cur.fetchall()
            ]
    return _schema_cache


def reset_schema_cache():
    global _schema_cache
    _schema_cache = None


def parse_schema_filter(schemas: str | None) -> list[str]:
    if not schemas:
        return DEFAULT_SCHEMAS
    parsed = [schema.strip() for schema in schemas.split(",") if schema.strip()]
    return parsed or DEFAULT_SCHEMAS


def from_timestamp(ts: float) -> datetime.datetime:
    return datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).astimezone()


def list_directory_summary(path: Path) -> EtlDirectorySummary:
    if not path.exists():
        return EtlDirectorySummary(
            name=path.name,
            path=str(path),
            exists=False,
            total_files=0,
            csv_files=0,
            xlsx_files=0,
            latest_file_at=None,
            files=[],
        )

    files: list[EtlFileEntry] = []
    latest_file_at: datetime.datetime | None = None
    csv_count = 0
    xlsx_count = 0

    disk_entries: list[tuple[Path, os.stat_result]] = []
    for item in path.iterdir():
        if not item.is_file():
            continue
        disk_entries.append((item, item.stat()))

    disk_entries.sort(key=lambda pair: (-pair[1].st_mtime, pair[0].name.lower()))

    for item, stat in disk_entries:
        modified_at = from_timestamp(stat.st_mtime)
        files.append(
            EtlFileEntry(
                name=item.name,
                extension=item.suffix.lower(),
                size_bytes=stat.st_size,
                modified_at=modified_at,
            )
        )
        if item.suffix.lower() == ".csv":
            csv_count += 1
        if item.suffix.lower() in {".xlsx", ".xlsm", ".xls"}:
            xlsx_count += 1
        if latest_file_at is None or modified_at > latest_file_at:
            latest_file_at = modified_at

    return EtlDirectorySummary(
        name=path.name,
        path=str(path),
        exists=True,
        total_files=len(files),
        csv_files=csv_count,
        xlsx_files=xlsx_count,
        latest_file_at=latest_file_at,
        files=files,
    )


def execution_item_from_row(row: tuple) -> EtlExecutionItem:
    batch_id = None
    offset = 0
    if len(row) >= 13:
        batch_id = row[1]
        offset = 1

    return EtlExecutionItem(
        id=int(row[0]),
        batch_id=batch_id,
        source_key=row[1 + offset],
        filepath=row[2 + offset],
        status=row[3 + offset],
        started_at=row[4 + offset],
        finished_at=row[5 + offset],
        rows_read=int(row[6 + offset] or 0),
        rows_inserted=int(row[7 + offset] or 0),
        rows_updated=int(row[8 + offset] or 0),
        rows_skipped=int(row[9 + offset] or 0),
        rows_rejected=int(row[10 + offset] or 0),
        error_message=row[11 + offset],
    )


def load_lineage_sources() -> list[LineageSource]:
    try:
        from etl.config.sources import SOURCES
    except Exception as exc:
        raise HTTPException(500, f"No se pudo cargar etl.config.sources: {exc}") from exc

    rows: list[LineageSource] = []
    for source_key, cfg in sorted(SOURCES.items()):
        target_schema, target_table = cfg["table"]
        role = {
            "cat": "catalog",
            "dim": "dimension",
            "fact": "fact",
            "raw": "raw",
            "etl": "control",
        }.get(target_schema, "unknown")
        rows.append(
            LineageSource(
                source_key=source_key,
                file_name=cfg.get("file", ""),
                target_schema=target_schema,
                target_table=target_table,
                role=role,
                pk_cols=list(cfg.get("pk_cols", [])),
                upsert_mode=cfg.get("upsert_mode", "merge"),
            )
        )
    return rows


LOGICAL_RELATIONS: list[LogicalRelation] = [
    LogicalRelation(
        source_key="PHXX",
        source_column="Cod_cliente",
        target_table="dim.cliente",
        target_column="cod_cliente",
        confidence="high",
        evidence="etl/config/sources.py pk_cols + load_dim_cliente + fact.ventas.cod_cliente",
    ),
    LogicalRelation(
        source_key="PHXX",
        source_column="Codigo_Mat",
        target_table="dim.producto",
        target_column="codigo_mat",
        confidence="high",
        evidence="etl/config/sources.py + load_dim_producto + fact.ventas.codigo_mat",
    ),
    LogicalRelation(
        source_key="PHXX",
        source_column="CodVend",
        target_table="dim.vendedor",
        target_column="cod_vendedor",
        confidence="high",
        evidence="etl/pipeline.py load_dim_vendedor + fact.ventas.cod_vendedor",
    ),
    LogicalRelation(
        source_key="AVPH",
        source_column="Cliente",
        target_table="dim.cliente",
        target_column="cod_cliente",
        confidence="high",
        evidence="etl/config/sources.py (AVPH) + transform_cxc -> fact.cxc.cod_cliente",
    ),
    LogicalRelation(
        source_key="AVAC",
        source_column="Cond. Pago",
        target_table="cat.condicion_pago",
        target_column="cod",
        confidence="medium",
        evidence="etl/config/sources.py (AVAC) + correspondencia semántica de catálogo",
    ),
    LogicalRelation(
        source_key="PEDIDOS/PEDIDOSFULL",
        source_column="Material",
        target_table="dim.producto",
        target_column="codigo_mat",
        confidence="high",
        evidence="etl/config/sources.py -> fact.pedidos.codigo_mat",
    ),
    LogicalRelation(
        source_key="INVPT/INVMP/INVPT_GENERAL",
        source_column="Codigo_Mat",
        target_table="dim.producto",
        target_column="codigo_mat",
        confidence="high",
        evidence="etl/config/sources.py -> fact.inventario.codigo_mat",
    ),
    LogicalRelation(
        source_key="O_PH/O_HG/O_PM",
        source_column="Codigo_Mat",
        target_table="dim.producto",
        target_column="codigo_mat",
        confidence="high",
        evidence="etl/config/sources.py -> fact.ordenes.codigo_mat",
    ),
    LogicalRelation(
        source_key="C_PH/C_HG",
        source_column="Codigo_Mat",
        target_table="dim.producto",
        target_column="codigo_mat",
        confidence="high",
        evidence="etl/config/sources.py -> fact.consumos.codigo_mat",
    ),
    LogicalRelation(
        source_key="N_PH",
        source_column="Codigo_Mat",
        target_table="dim.producto",
        target_column="codigo_mat",
        confidence="high",
        evidence="etl/config/sources.py -> fact.notificaciones.codigo_mat",
    ),
    LogicalRelation(
        source_key="PRECIOS",
        source_column="Material",
        target_table="dim.producto",
        target_column="codigo_mat",
        confidence="high",
        evidence="etl/config/sources.py -> fact.precios.codigo_mat",
    ),
]
