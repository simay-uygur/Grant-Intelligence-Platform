from fastapi import APIRouter

from backend.schemas.health import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Simple service status endpoint for local startup and connectivity checks.",
    response_description="Current backend health status.",
)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")
