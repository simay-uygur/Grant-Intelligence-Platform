from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.api.dependencies import auth_service
from backend.schemas.auth import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    UserResponse,
)
from backend.services.auth_service import AuthError

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


@router.post("/register", response_model=AuthResponse, summary="Register an account")
def register(payload: RegisterRequest) -> AuthResponse:
    try:
        user = auth_service.register(payload.email, payload.password)
        return AuthResponse(token=auth_service.issue_token(user), user=UserResponse(**user))
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/login", response_model=AuthResponse, summary="Log in")
def login(payload: LoginRequest) -> AuthResponse:
    try:
        token, user = auth_service.login(payload.email, payload.password)
        return AuthResponse(token=token, user=UserResponse(**user))
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/logout", response_model=MessageResponse, summary="Log out")
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> MessageResponse:
    if credentials and credentials.credentials:
        auth_service.revoke_token(credentials.credentials)
    return MessageResponse(message="Logged out successfully.")
