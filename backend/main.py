from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routers import ALL_ROUTERS


def create_app() -> FastAPI:
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

    for router in ALL_ROUTERS:
        app.include_router(router)

    return app


app = create_app()
