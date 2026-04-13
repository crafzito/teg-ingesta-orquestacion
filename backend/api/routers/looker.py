import datetime
import decimal
import time

from fastapi import APIRouter, Depends, HTTPException, Query

from ...auth import require_role
from ..core import (
    ALLOWED_EXPORT_SCHEMAS,
    ALLOWED_OPERATORS,
    LOOKER_VIEW_LABELS,
    SAFE_IDENTIFIER,
    SAFE_VIEW_NAME,
    VIEW_CATEGORIES,
    build_view_sql,
    is_protected,
    readonly_conn,
    write_conn,
)
from ..models import BaseView, CreateLookerViewRequest, LookerView, ViewColumn

router = APIRouter(
    prefix="/api",
    tags=["looker"],
    dependencies=[Depends(require_role({"superadmin", "admin"}))],
)


@router.get("/looker/views", response_model=list[LookerView])
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
    with readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    result = []
    for name, definition, kind in rows:
        is_custom = not is_protected(name)
        category = VIEW_CATEGORIES.get(name, "Personalizada")
        if kind == "matview":
            category = VIEW_CATEGORIES.get(name, "Materializada")
        result.append(
            LookerView(
                name=name,
                view_definition=definition or "",
                is_custom=is_custom,
                category=category,
                description="",
            )
        )
    return result


@router.get("/looker/base-views", response_model=list[BaseView])
def list_base_views():
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
    with readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    return [
        BaseView(
            schema_name=row[0],
            view_name=row[1],
            full_name=f"{row[0]}.{row[1]}",
            label=LOOKER_VIEW_LABELS.get(row[1], row[1]),
        )
        for row in rows
    ]


@router.get("/looker/views/{view_name}/columns", response_model=list[ViewColumn])
def get_view_columns(view_name: str):
    if not SAFE_VIEW_NAME.match(view_name):
        raise HTTPException(400, "Nombre de vista inválido")
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
    with readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (view_name,))
            rows = cur.fetchall()
    return [ViewColumn(column_name=row[0], data_type=row[1]) for row in rows]


@router.post("/looker/views", status_code=201)
def create_looker_view(req: CreateLookerViewRequest):
    if is_protected(req.name):
        raise HTTPException(400, f"'{req.name}' es una vista protegida")
    view_sql = build_view_sql(req.name, req.base_view, req.filters)
    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(view_sql)
    return {"name": req.name, "sql": view_sql}


@router.delete("/looker/views/{view_name}", status_code=200)
def delete_looker_view(view_name: str, current_user=Depends(require_role({"superadmin"}))):
    if not SAFE_VIEW_NAME.match(view_name):
        raise HTTPException(400, "Nombre de vista inválido")
    if is_protected(view_name):
        raise HTTPException(400, f"'{view_name}' es una vista del sistema y no puede eliminarse")
    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f'DROP VIEW IF EXISTS public."{view_name}"')
    return {"deleted": view_name}


@router.get("/export/{view_name}")
def export_view(
    view_name: str,
    schema: str = Query(default="public"),
    limit: int = Query(default=500, ge=1, le=5_000),
    offset: int = Query(default=0, ge=0),
    filter: list[str] = Query(default=[]),
):
    if not SAFE_IDENTIFIER.match(view_name):
        raise HTTPException(400, "Nombre de vista inválido")
    if not SAFE_IDENTIFIER.match(schema) or schema not in ALLOWED_EXPORT_SCHEMAS:
        raise HTTPException(
            400,
            f"Schema no permitido: '{schema}'. Permitidos: {sorted(ALLOWED_EXPORT_SCHEMAS)}",
        )

    where_clauses: list[str] = []
    parsed_filters: list[dict] = []
    for filter_str in filter:
        parts = filter_str.split(":", 2)
        if len(parts) != 3:
            raise HTTPException(
                400,
                f"Filtro mal formado: '{filter_str}'. Formato esperado: columna:operador:valor",
            )
        col, op, val = parts
        if not SAFE_IDENTIFIER.match(col):
            raise HTTPException(400, f"Columna inválida: '{col}'")
        if op not in ALLOWED_OPERATORS:
            raise HTTPException(
                400,
                f"Operador no permitido: '{op}'. Permitidos: {sorted(ALLOWED_OPERATORS)}",
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
    data_sql = f'SELECT * FROM {schema}."{view_name}"{where_sql}\nLIMIT {limit} OFFSET {offset}'

    def local_serialize(value: object) -> object:
        if isinstance(value, decimal.Decimal):
            return float(value)
        if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
            return value.isoformat()
        return value

    t0 = time.perf_counter()
    try:
        with readonly_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(count_sql)
                total = cur.fetchone()[0]
                cur.execute(data_sql)
                col_names = [desc.name for desc in cur.description]
                rows = cur.fetchall()
    except Exception as exc:
        raise HTTPException(400, f"Error al ejecutar la consulta: {exc}") from exc

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    data = [
        {col_names[i]: local_serialize(row[i]) for i in range(len(col_names))}
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

