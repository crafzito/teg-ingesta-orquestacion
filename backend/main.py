import os
import re
import time
import datetime
import decimal
from pathlib import Path
from contextlib import contextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from psycopg2 import pool as pg_pool

load_dotenv()

# --- Connection pool (reusa conexiones, elimina overhead de ~80ms/req) ---
_pool = pg_pool.SimpleConnectionPool(
    minconn=2,
    maxconn=10,
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", "5432")),
    dbname=os.getenv("DB_NAME", "sap_etl"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD", "postgres"),
)

app = FastAPI(title="TEG SQL Explorer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:6006",
        "http://127.0.0.1:6006",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic models ---

class QueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=10_000)
    limit: int = Field(default=1000, ge=1, le=10_000)


class QueryResponse(BaseModel):
    columns: list[str]
    rows: list[list]
    row_count: int
    execution_time_ms: float
    truncated: bool


class SchemaTable(BaseModel):
    schema_name: str
    table_name: str
    table_type: str


class SchemaColumn(BaseModel):
    schema_name: str
    table_name: str
    column_name: str
    ordinal_position: int
    data_type: str
    is_nullable: bool
    column_default: str | None
    is_primary_key: bool


class SchemaRelation(BaseModel):
    constraint_name: str
    source_schema: str
    source_table: str
    source_column: str
    target_schema: str
    target_table: str
    target_column: str


class LineageSource(BaseModel):
    source_key: str
    file_name: str
    target_schema: str
    target_table: str
    role: str
    pk_cols: list[str]
    upsert_mode: str


class LogicalRelation(BaseModel):
    source_key: str
    source_column: str
    target_table: str
    target_column: str
    confidence: str
    evidence: str


# --- SQL validation ---

_FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|"
    r"COPY|EXECUTE|CALL|DO\s|LOCK|VACUUM)\b",
    re.IGNORECASE,
)

_ALLOWED_START = re.compile(r"^\s*(SELECT|WITH|EXPLAIN)\b", re.IGNORECASE)
_SQL_COMMENTS = re.compile(r"--[^\n]*\n?", re.MULTILINE)


def _validate_readonly(sql: str) -> str:
    cleaned = sql.strip().rstrip(";").strip()
    if not cleaned:
        raise HTTPException(400, "Query vacia")
    no_comments = _SQL_COMMENTS.sub("", cleaned).strip()
    if not no_comments:
        raise HTTPException(400, "Query vacia")
    if not _ALLOWED_START.match(no_comments):
        raise HTTPException(400, "Solo se permiten SELECT, WITH y EXPLAIN")
    match = _FORBIDDEN.search(no_comments)
    if match:
        raise HTTPException(400, f"Keyword prohibido: {match.group(0).upper()}")
    return cleaned


# --- DB helpers ---

@contextmanager
def _readonly_conn():
    conn = _pool.getconn()
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
        _pool.putconn(conn)


def _serialize(value):
    if value is None:
        return None
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, memoryview):
        return bytes(value).hex()
    if isinstance(value, (list, tuple)):
        return [_serialize(v) for v in value]
    return value


# --- Schema cache (no cambia en runtime) ---

_schema_cache: list[SchemaTable] | None = None


def _get_schema() -> list[SchemaTable]:
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
    with _readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            _schema_cache = [
                SchemaTable(
                    schema_name=r[0],
                    table_name=r[1],
                    table_type="view" if r[2] == "VIEW" else "table",
                )
                for r in cur.fetchall()
            ]
    return _schema_cache


def _default_schemas() -> list[str]:
    return ["cat", "dim", "fact", "raw", "etl"]


def _parse_schema_filter(schemas: str | None) -> list[str]:
    if not schemas:
        return _default_schemas()
    parsed = [s.strip() for s in schemas.split(",") if s.strip()]
    return parsed or _default_schemas()


def _load_lineage_sources() -> list[LineageSource]:
    try:
        from etl.config.sources import SOURCES
    except Exception as e:
        raise HTTPException(500, f"No se pudo cargar etl.config.sources: {e}") from e

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


# Relaciones lógicas documentadas a partir de:
# - mapeos de etl/config/sources.py
# - joins explícitos en sql/looker_queries.sql
# - comentarios REFERENCES en sql/schema.sql
_LOGICAL_RELATIONS: list[LogicalRelation] = [
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


# --- Endpoints ---

@app.get("/api/health")
def health():
    try:
        with _readonly_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, str(e))


@app.get("/api/schema", response_model=list[SchemaTable])
def list_schema():
    return _get_schema()


@app.get("/api/schema/columns", response_model=list[SchemaColumn])
def list_schema_columns(schemas: str | None = None, table_name: str | None = None):
    schema_filter = _parse_schema_filter(schemas)
    sql = """
        SELECT
            c.table_schema,
            c.table_name,
            c.column_name,
            c.ordinal_position,
            c.data_type,
            c.is_nullable,
            c.column_default,
            EXISTS (
                SELECT 1
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                 AND tc.table_name = kcu.table_name
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = c.table_schema
                  AND tc.table_name = c.table_name
                  AND kcu.column_name = c.column_name
            ) AS is_primary_key
        FROM information_schema.columns c
        WHERE c.table_schema = ANY(%s)
          AND (%s::text IS NULL OR c.table_name = %s)
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
    """
    with _readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (schema_filter, table_name, table_name))
            rows = cur.fetchall()
    return [
        SchemaColumn(
            schema_name=r[0],
            table_name=r[1],
            column_name=r[2],
            ordinal_position=r[3],
            data_type=r[4],
            is_nullable=r[5] == "YES",
            column_default=r[6],
            is_primary_key=bool(r[7]),
        )
        for r in rows
    ]


@app.get("/api/schema/relations", response_model=list[SchemaRelation])
def list_schema_relations(schemas: str | None = None):
    schema_filter = _parse_schema_filter(schemas)
    sql = """
        SELECT
            tc.constraint_name,
            kcu.table_schema AS source_schema,
            kcu.table_name AS source_table,
            kcu.column_name AS source_column,
            ccu.table_schema AS target_schema,
            ccu.table_name AS target_table,
            ccu.column_name AS target_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND kcu.table_schema = ANY(%s)
        ORDER BY kcu.table_schema, kcu.table_name, tc.constraint_name, kcu.ordinal_position
    """
    with _readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (schema_filter,))
            rows = cur.fetchall()
    return [
        SchemaRelation(
            constraint_name=r[0],
            source_schema=r[1],
            source_table=r[2],
            source_column=r[3],
            target_schema=r[4],
            target_table=r[5],
            target_column=r[6],
        )
        for r in rows
    ]


@app.get("/api/lineage/sources", response_model=list[LineageSource])
def list_lineage_sources():
    return _load_lineage_sources()


@app.get("/api/lineage/relations", response_model=list[LogicalRelation])
def list_logical_relations():
    return _LOGICAL_RELATIONS


@app.get("/api/lineage/input-files")
def list_input_files():
    base = Path("data/input")
    if not base.exists():
        return {
            "total_files": 0,
            "all_files": [],
            "csv_count": 0,
            "csv_files": [],
            "non_csv_count": 0,
            "non_csv_files": [],
        }

    all_files = sorted([p.name for p in base.iterdir() if p.is_file()])
    csv_files = sorted([name for name in all_files if Path(name).suffix.lower() == ".csv"])
    non_csv_files = sorted([name for name in all_files if Path(name).suffix.lower() != ".csv"])

    return {
        "total_files": len(all_files),
        "all_files": all_files,
        "csv_count": len(csv_files),
        "csv_files": csv_files,
        "non_csv_count": len(non_csv_files),
        "non_csv_files": non_csv_files,
    }


@app.post("/api/schema/refresh")
def refresh_schema():
    global _schema_cache
    _schema_cache = None
    return {"status": "refreshed"}


@app.post("/api/query", response_model=QueryResponse)
def execute_query(req: QueryRequest):
    sql = _validate_readonly(req.sql)

    t0 = time.perf_counter()
    truncated = False
    try:
        with _readonly_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)

                if cur.description is None:
                    columns = ["result"]
                    all_rows = [[str(r[0])] for r in cur.fetchall()]
                else:
                    columns = [desc[0] for desc in cur.description]
                    all_rows = []
                    while True:
                        batch = cur.fetchmany(500)
                        if not batch:
                            break
                        for row in batch:
                            if len(all_rows) >= req.limit:
                                truncated = True
                                break
                            all_rows.append([_serialize(v) for v in row])
                        if truncated:
                            break

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))

    elapsed = (time.perf_counter() - t0) * 1000
    return QueryResponse(
        columns=columns,
        rows=all_rows,
        row_count=len(all_rows),
        execution_time_ms=round(elapsed, 2),
        truncated=truncated,
    )
