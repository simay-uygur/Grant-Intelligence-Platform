from fastapi import APIRouter, HTTPException

from backend.api.dependencies import auth_service
from backend.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from backend.services.auth_service import AuthError

router = APIRouter()


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
