import re
import time
import datetime
import decimal
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from psycopg2 import pool as pg_pool

from etl.config import load_config

config = load_config()

# --- Connection pool (reusa conexiones, elimina overhead de ~80ms/req) ---
_pool = pg_pool.SimpleConnectionPool(
    minconn=2,
    maxconn=10,
    host=config.db_host,
    port=config.db_port,
    dbname=config.db_name,
    user=config.db_user,
    password=config.db_password,
)

app = FastAPI(title="TEG SQL Explorer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
        WHERE t.table_schema IN ('staging', 'core')
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
