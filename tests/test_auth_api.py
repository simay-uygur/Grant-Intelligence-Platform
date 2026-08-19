from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.services.auth_service import AuthService


def _build_client(database_path: Path) -> TestClient:
    app = create_app()
    auth_deps = __import__("backend.api.dependencies", fromlist=["auth_service"])
    auth_routes = __import__("backend.api.routes.auth", fromlist=["auth_service"])
    service = AuthService(database_path=str(database_path))
    auth_deps.auth_service = service
    auth_routes.auth_service = service
    return TestClient(app)


def test_auth_register_login_logout_flow(tmp_path: Path) -> None:
    client = _build_client(tmp_path / "test_auth.db")

    # 1. Register account
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert reg_res.status_code == 200
    token = reg_res.json()["token"]
    assert token

    # 2. Login account
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert login_res.status_code == 200
    login_token = login_res.json()["token"]
    assert login_token

    # 3. Logout / revoke token
    logout_res = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["message"] == "Logged out successfully."

    # 4. Attempt to verify revoked token
    auth_deps = __import__("backend.api.dependencies", fromlist=["auth_service"])
    try:
        auth_deps.auth_service.user_from_token(token)
        assert False, "Expected user_from_token to fail for revoked token"
    except Exception as exc:
        assert "Token has been revoked" in str(exc)
