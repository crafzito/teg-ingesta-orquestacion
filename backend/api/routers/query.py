import time

from fastapi import APIRouter, HTTPException

from ..core import readonly_conn, serialize, validate_readonly
from ..models import QueryRequest, QueryResponse

router = APIRouter(prefix="/api", tags=["query"])


@router.post("/query", response_model=QueryResponse)
def execute_query(req: QueryRequest):
    sql = validate_readonly(req.sql)

    t0 = time.perf_counter()
    truncated = False
    try:
        with readonly_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)

                if cur.description is None:
                    columns = ["result"]
                    all_rows = [[str(row[0])] for row in cur.fetchall()]
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
                            all_rows.append([serialize(value) for value in row])
                        if truncated:
                            break

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc

    elapsed = (time.perf_counter() - t0) * 1000
    return QueryResponse(
        columns=columns,
        rows=all_rows,
        row_count=len(all_rows),
        execution_time_ms=round(elapsed, 2),
        truncated=truncated,
    )
