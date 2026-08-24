"""Global exception handlers registered on the FastAPI application."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi.responses import JSONResponse

if TYPE_CHECKING:
    from fastapi import FastAPI, Request

from backend.services.agent_service import AgentUnavailableError

logger = logging.getLogger("backend.error_handlers")


def register_error_handlers(app: FastAPI) -> None:
    """Attach exception handlers that return structured JSON for common errors."""

    @app.exception_handler(ValueError)
    async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
        logger.warning("ValueError caught by global handler: %s", exc)
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(AgentUnavailableError)
    async def agent_unavailable_handler(_request: Request, exc: AgentUnavailableError) -> JSONResponse:
        logger.error("Agent unavailable: %s", exc)
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def generic_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
