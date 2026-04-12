from .auth import router as auth_router
from .etl import router as etl_router
from .health import router as health_router
from .lineage import router as lineage_router
from .looker import router as looker_router
from .query import router as query_router
from .schema import router as schema_router

ALL_ROUTERS = [
    auth_router,
    health_router,
    schema_router,
    lineage_router,
    etl_router,
    looker_router,
    query_router,
]

