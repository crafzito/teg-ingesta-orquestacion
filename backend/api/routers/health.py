from fastapi import APIRouter, HTTPException

from ..core import readonly_conn

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health():
    try:
        with readonly_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, str(exc)) from exc

