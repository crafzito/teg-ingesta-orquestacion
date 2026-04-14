from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routers import ALL_ROUTERS


def create_app() -> FastAPI:
    app = FastAPI(title="TEG SQL Explorer", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for router in ALL_ROUTERS:
        app.include_router(router)

    return app


app = create_app()
