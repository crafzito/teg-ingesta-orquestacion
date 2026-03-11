from fastapi import APIRouter

from ..core import get_schema, parse_schema_filter, readonly_conn, reset_schema_cache
from ..models import SchemaColumn, SchemaRelation, SchemaTable

router = APIRouter(prefix="/api/schema", tags=["schema"])


@router.get("", response_model=list[SchemaTable])
def list_schema():
    return get_schema()


@router.get("/columns", response_model=list[SchemaColumn])
def list_schema_columns(schemas: str | None = None, table_name: str | None = None):
    schema_filter = parse_schema_filter(schemas)
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
    with readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (schema_filter, table_name, table_name))
            rows = cur.fetchall()
    return [
        SchemaColumn(
            schema_name=row[0],
            table_name=row[1],
            column_name=row[2],
            ordinal_position=row[3],
            data_type=row[4],
            is_nullable=row[5] == "YES",
            column_default=row[6],
            is_primary_key=bool(row[7]),
        )
        for row in rows
    ]


@router.get("/relations", response_model=list[SchemaRelation])
def list_schema_relations(schemas: str | None = None):
    schema_filter = parse_schema_filter(schemas)
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
    with readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (schema_filter,))
            rows = cur.fetchall()
    return [
        SchemaRelation(
            constraint_name=row[0],
            source_schema=row[1],
            source_table=row[2],
            source_column=row[3],
            target_schema=row[4],
            target_table=row[5],
            target_column=row[6],
        )
        for row in rows
    ]


@router.post("/refresh")
def refresh_schema():
    reset_schema_cache()
    return {"status": "refreshed"}

