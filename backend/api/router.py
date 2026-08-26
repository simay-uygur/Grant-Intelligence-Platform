from fastapi import APIRouter

from backend.api.routes.auth import router as auth_router
from backend.api.routes.chat import router as chat_router
from backend.api.routes.documents import router as documents_router
from backend.api.routes.grants import router as grants_router
from backend.api.routes.health import router as health_router
from backend.api.routes.meta import router as meta_router
from backend.api.routes.uploads import router as uploads_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(health_router, tags=["health"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(grants_router, prefix="/grants", tags=["grants"])
api_router.include_router(documents_router, tags=["documents"])
api_router.include_router(uploads_router, tags=["documents"])
api_router.include_router(meta_router, prefix="/meta", tags=["meta"])
