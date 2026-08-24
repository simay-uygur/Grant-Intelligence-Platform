import time
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.error_handlers import register_error_handlers
from backend.api.router import api_router
from backend.core.config import settings
from backend.core.logging import setup_logging


def create_app() -> FastAPI:
    setup_logging(debug=settings.debug)

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
            "description": ("SQLite-backed application storage plus drafting and section rewrite endpoints backed by the local agent layer."),
        },
        {
            "name": "meta",
            "description": "Bootstrap metadata that helps the frontend discover backend configuration and available endpoints.",
        },
    ]
    app = FastAPI(
        title=settings.app_name,
        summary="Local-first backend for grant search, chat orchestration, and Bedrock integration.",
        description=("This API supports the Grant Intelligence Platform MVP. Use it to send chat messages, run grant searches, and fetch frontend bootstrap metadata for local integration."),
        version=settings.app_version,
        openapi_tags=tags_metadata,
    )
    # Rate limiting for AI & document endpoints to prevent abuse / token drain
    request_history: dict[str, list[float]] = {}

    @app.middleware("http")
    async def rate_limit_and_security_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Protect resource-intensive agent and Bedrock endpoints (60 req/min per IP)
        if any(path.startswith(f"{settings.api_prefix}{prefix}") for prefix in ["/chat", "/documents", "/grants"]):
            now = time.time()
            timestamps = [t for t in request_history.get(client_ip, []) if now - t < 60]
            if len(timestamps) >= 60:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please wait a moment before trying again."},
                )
            timestamps.append(now)
            request_history[client_ip] = timestamps

        return await call_next(request)

    allow_credentials = "*" not in settings.frontend_cors_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_cors_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)
    register_error_handlers(app)
    return app


app = create_app()
