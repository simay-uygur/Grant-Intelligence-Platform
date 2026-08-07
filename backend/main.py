from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.router import api_router
from backend.core.config import settings


def create_app() -> FastAPI:
    tags_metadata = [
        {
            "name": "health",
            "description": "Basic service health and connectivity checks.",
        },
        {
            "name": "chat",
            "description": "Frontend-facing chat endpoints for sending user messages into the grant assistant flow.",
        },
        {
            "name": "grants",
            "description": "Grant search endpoints backed by the local agent layer.",
        },
        {
            "name": "documents",
            "description": (
                "SQLite-backed application storage plus drafting and section "
                "rewrite endpoints backed by the local agent layer."
            ),
        },
        {
            "name": "meta",
            "description": "Bootstrap metadata that helps the frontend discover backend configuration and available endpoints.",
        },
    ]
    app = FastAPI(
        title=settings.app_name,
        summary="Local-first backend for grant search, chat orchestration, and Bedrock integration.",
        description=(
            "This API supports the Grant Intelligence Platform MVP. "
            "Use it to send chat messages, run grant searches, and fetch "
            "frontend bootstrap metadata for local integration."
        ),
        version=settings.app_version,
        openapi_tags=tags_metadata,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
