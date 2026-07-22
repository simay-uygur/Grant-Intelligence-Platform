from fastapi import APIRouter

from app.api.routes.chat import router as chat_router
from app.api.routes.grants import router as grants_router
from app.api.routes.health import router as health_router
from app.api.routes.meta import router as meta_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(grants_router, prefix="/grants", tags=["grants"])
api_router.include_router(meta_router, prefix="/meta", tags=["meta"])
