import os
import re
import time
import datetime
import decimal
from pathlib import Path
from contextlib import contextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
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
        "http://localhost:5174",
        "http://127.0.0.1:5174",
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


# --- Looker View models ---

_SAFE_IDENTIFIER = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,62}$")
_SAFE_VIEW_NAME = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
_ALLOWED_OPERATORS = frozenset({"=", "!=", "<", ">", "<=", ">=", "LIKE", "ILIKE"})
_ALLOWED_EXPORT_SCHEMAS = frozenset({"public", "reporting", "fact", "dim", "cat", "raw"})

# Prefijos que identifican vistas del sistema (no borrables por el usuario)
_SYSTEM_PREFIXES = ("v_", "dim_", "cat_", "fact_")


def _is_protected(name: str) -> bool:
    return any(name.startswith(p) for p in _SYSTEM_PREFIXES)


_VIEW_CATEGORIES: dict[str, str] = {
    "v_ventas": "Ventas", "v_cxc": "Ctas por Cobrar", "v_cxp": "Ctas por Pagar",
    "v_inventario": "Inventario", "v_ordenes": "Órdenes", "v_pedidos": "Pedidos",
    "dim_sociedad": "Dimensión", "dim_centro": "Dimensión",
    "dim_producto": "Dimensión", "dim_cliente": "Dimensión",
    "dim_vendedor": "Dimensión", "dim_condicion_pago": "Dimensión",
    "dim_tipo_material": "Dimensión", "dim_grupo_material": "Dimensión",
}


class ViewFilter(BaseModel):
    column: str = Field(..., min_length=1, max_length=100)
    operator: str = Field(..., min_length=1, max_length=6)
    value: str = Field(..., max_length=500)


class CreateLookerViewRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=63)
    base_view: str = Field(..., min_length=3, max_length=130)
    description: str = Field(default="", max_length=500)
    filters: list[ViewFilter] = Field(default_factory=list)


class LookerView(BaseModel):
    name: str
    view_definition: str
    is_custom: bool
    category: str
    description: str


class BaseView(BaseModel):
    schema_name: str
    view_name: str
    full_name: str
    label: str


class ViewColumn(BaseModel):
    column_name: str
    data_type: str


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
def _write_conn():
    conn = _pool.getconn()
    try:
        conn.autocommit = False
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def _build_view_sql(name: str, base_view: str, filters: list[ViewFilter]) -> str:
    if not _SAFE_VIEW_NAME.match(name):
        raise HTTPException(400, f"Nombre de vista inválido: '{name}'")
    parts = base_view.split(".")
    if len(parts) != 2:
        raise HTTPException(400, "base_view debe tener formato 'schema.nombre'")
    base_schema, base_name = parts
    if not _SAFE_IDENTIFIER.match(base_schema) or not _SAFE_IDENTIFIER.match(base_name):
        raise HTTPException(400, "Nombre de vista base inválido")
    where_clauses = []
    for f in filters:
        if not _SAFE_IDENTIFIER.match(f.column):
            raise HTTPException(400, f"Columna inválida: '{f.column}'")
        if f.operator not in _ALLOWED_OPERATORS:
            raise HTTPException(400, f"Operador inválido: '{f.operator}'")
        escaped = f.value.replace("'", "''")
        where_clauses.append(f'"{f.column}" {f.operator} \'{escaped}\'')
    sql = f'CREATE OR REPLACE VIEW public."{name}" AS\nSELECT * FROM {base_schema}."{base_name}"'
    if where_clauses:
        sql += "\nWHERE " + "\n  AND ".join(where_clauses)
    return sql


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


# Vistas de reporting que Looker Studio consume (ya son vistas regulares,
# no requieren refresh — siempre muestran data actual).
_LOOKER_VIEWS = [
    "public.v_ventas",
    "public.v_cxc",
    "public.v_cxp",
    "public.v_inventario",
    "public.v_ordenes",
    "public.v_pedidos",
]


# --- Looker endpoints ---

@app.get("/api/looker/views", response_model=list[LookerView])
def list_looker_views():
    sql = """
        SELECT viewname AS name, definition AS defn, 'view' AS kind
        FROM pg_views
        WHERE schemaname = 'public'
        UNION ALL
        SELECT matviewname AS name, definition AS defn, 'matview' AS kind
        FROM pg_matviews
        WHERE schemaname = 'public'
        ORDER BY name
    """
    with _readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    result = []
    for name, defn, kind in rows:
        is_custom = not _is_protected(name)
        category = _VIEW_CATEGORIES.get(name, "Personalizada")
        if kind == "matview":
            category = _VIEW_CATEGORIES.get(name, "Materializada")
        result.append(LookerView(
            name=name,
            view_definition=defn or "",
            is_custom=is_custom,
            category=category,
            description="",
        ))
    return result


@app.get("/api/looker/base-views", response_model=list[BaseView])
def list_base_views():
    _LABELS: dict[str, str] = {
        "v_ventas": "Ventas", "v_cxc": "Cuentas por Cobrar", "v_cxp": "Cuentas por Pagar",
        "v_inventario": "Inventario", "v_ordenes": "Órdenes", "v_pedidos": "Pedidos",
    }
    sql = """
        SELECT schemaname AS sn, viewname AS vn
        FROM pg_views
        WHERE schemaname IN ('reporting', 'public')
        UNION ALL
        SELECT schemaname, matviewname
        FROM pg_matviews
        WHERE schemaname IN ('reporting', 'public')
        ORDER BY sn, vn
    """
    with _readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    return [
        BaseView(
            schema_name=r[0],
            view_name=r[1],
            full_name=f"{r[0]}.{r[1]}",
            label=_LABELS.get(r[1], r[1]),
        )
        for r in rows
    ]


@app.get("/api/looker/views/{view_name}/columns", response_model=list[ViewColumn])
def get_view_columns(view_name: str):
    if not _SAFE_VIEW_NAME.match(view_name):
        raise HTTPException(400, "Nombre de vista inválido")
    # pg_attribute funciona tanto para vistas regulares como materializadas
    sql = """
        SELECT a.attname AS column_name,
               pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
        JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND c.relname = %s
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum
    """
    with _readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (view_name,))
            rows = cur.fetchall()
    return [ViewColumn(column_name=r[0], data_type=r[1]) for r in rows]


@app.post("/api/looker/views", status_code=201)
def create_looker_view(req: CreateLookerViewRequest):
    if _is_protected(req.name):
        raise HTTPException(400, f"'{req.name}' es una vista protegida")
    view_sql = _build_view_sql(req.name, req.base_view, req.filters)
    with _write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(view_sql)
    return {"name": req.name, "sql": view_sql}


@app.delete("/api/looker/views/{view_name}", status_code=200)
def delete_looker_view(view_name: str):
    if not _SAFE_VIEW_NAME.match(view_name):
        raise HTTPException(400, "Nombre de vista inválido")
    if _is_protected(view_name):
        raise HTTPException(400, f"'{view_name}' es una vista del sistema y no puede eliminarse")
    with _write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f'DROP VIEW IF EXISTS public."{view_name}"')
    return {"deleted": view_name}


@app.get("/api/export/{view_name}")
def export_view(
    view_name: str,
    schema: str = Query(default="public"),
    limit: int = Query(default=500, ge=1, le=5_000),
    offset: int = Query(default=0, ge=0),
    filter: list[str] = Query(default=[]),
):
    """Exporta filas de una vista como JSON con filtros opcionales."""
    if not _SAFE_IDENTIFIER.match(view_name):
        raise HTTPException(400, "Nombre de vista inválido")
    if not _SAFE_IDENTIFIER.match(schema) or schema not in _ALLOWED_EXPORT_SCHEMAS:
        raise HTTPException(
            400,
            f"Schema no permitido: '{schema}'. Permitidos: {sorted(_ALLOWED_EXPORT_SCHEMAS)}",
        )

    # Parsear filtros con formato "columna:operador:valor"
    where_clauses: list[str] = []
    parsed_filters: list[dict] = []
    for f_str in filter:
        parts = f_str.split(":", 2)
        if len(parts) != 3:
            raise HTTPException(
                400,
                f"Filtro mal formado: '{f_str}'. Formato esperado: columna:operador:valor",
            )
        col, op, val = parts
        if not _SAFE_IDENTIFIER.match(col):
            raise HTTPException(400, f"Columna inválida: '{col}'")
        if op not in _ALLOWED_OPERATORS:
            raise HTTPException(
                400,
                f"Operador no permitido: '{op}'. Permitidos: {sorted(_ALLOWED_OPERATORS)}",
            )
        escaped = val.replace("'", "''")
        clause = (
            f'"{col}" ILIKE \'%{escaped}%\''
            if op == "ILIKE"
            else f'"{col}" {op} \'{escaped}\''
        )
        where_clauses.append(clause)
        parsed_filters.append({"column": col, "operator": op, "value": val})

    where_sql = ("\nWHERE " + "\n  AND ".join(where_clauses)) if where_clauses else ""
    count_sql = f'SELECT COUNT(*) FROM {schema}."{view_name}"{where_sql}'
    data_sql = (
        f'SELECT * FROM {schema}."{view_name}"{where_sql}'
        f"\nLIMIT {limit} OFFSET {offset}"
    )

    def _serialize(v: object) -> object:
        if isinstance(v, decimal.Decimal):
            return float(v)
        if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
            return v.isoformat()
        return v

    t0 = time.perf_counter()
    try:
        with _readonly_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(count_sql)
                total: int = cur.fetchone()[0]
                cur.execute(data_sql)
                col_names = [d.name for d in cur.description]
                rows = cur.fetchall()
    except Exception as exc:
        raise HTTPException(400, f"Error al ejecutar la consulta: {exc}") from exc

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    data = [
        {col_names[i]: _serialize(row[i]) for i in range(len(col_names))}
        for row in rows
    ]

    return {
        "view": view_name,
        "schema": schema,
        "total_records": total,
        "returned_records": len(rows),
        "truncated": (offset + len(rows)) < total,
        "offset": offset,
        "limit": limit,
        "filters_applied": parsed_filters,
        "execution_time_ms": elapsed_ms,
        "data": data,
    }


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
