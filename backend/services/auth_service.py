from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from backend.core.config import settings
from backend.core.database import build_engine, metadata, revoked_tokens_table, users_table
from backend.core.logging import get_logger

logger = get_logger("services.auth")


class AuthError(ValueError):
    pass


class AuthService:
    def __init__(self, database_path: str | None = None) -> None:
        self.engine = build_engine(database_path)
        self._initialize_schema()

    def _initialize_schema(self) -> None:
        metadata.create_all(self.engine)

    def register(self, email: str, password: str) -> dict[str, str]:
        normalized_email = self._normalize_email(email)
        if len(password) < 8:
            logger.warning("Registration failed: password too short for email %s", normalized_email)
            raise AuthError("Password must be at least 8 characters.")
        user_id = str(uuid4())
        try:
            with self.engine.begin() as connection:
                connection.execute(
                    users_table.insert().values(
                        id=user_id,
                        email=normalized_email,
                        password_hash=self._hash_password(password),
                        created_at=self._timestamp(),
                    )
                )
        except IntegrityError as exc:
            logger.warning("Registration failed: email already exists %s", normalized_email)
            raise AuthError("An account with that email already exists.") from exc
        logger.info("Successfully registered user %s (%s)", user_id, normalized_email)
        return {"id": user_id, "email": normalized_email}

    def login(self, email: str, password: str) -> tuple[str, dict[str, str]]:
        normalized_email = self._normalize_email(email)
        stmt = select(users_table.c.id, users_table.c.email, users_table.c.password_hash).where(users_table.c.email == normalized_email)
        with self.engine.begin() as connection:
            row = connection.execute(stmt).mappings().first()
        if row is None or not self._verify_password(password, row["password_hash"]):
            logger.warning("Login failed for email %s", normalized_email)
            raise AuthError("Invalid email or password.")
        user = {"id": row["id"], "email": row["email"]}
        logger.info("User logged in successfully: %s (%s)", user["id"], normalized_email)
        return self.issue_token(user), user

    def issue_token(self, user: dict[str, str]) -> str:
        now = datetime.now(UTC)
        return jwt.encode(
            {
                "sub": user["id"],
                "email": user["email"],
                "iat": now,
                "exp": now + timedelta(hours=settings.auth_token_ttl_hours),
            },
            settings.auth_secret_key,
            algorithm="HS256",
        )

    def revoke_token(self, token: str) -> None:
        if not token:
            return
        # Portable INSERT-if-absent (SQLite's "INSERT OR IGNORE" has no
        # PostgreSQL equivalent in plain SQL).
        with self.engine.begin() as connection:
            exists = connection.execute(select(revoked_tokens_table.c.token).where(revoked_tokens_table.c.token == token)).first()
            if exists is None:
                connection.execute(revoked_tokens_table.insert().values(token=token, revoked_at=self._timestamp()))

    def _is_token_revoked(self, token: str) -> bool:
        with self.engine.begin() as connection:
            row = connection.execute(select(revoked_tokens_table.c.token).where(revoked_tokens_table.c.token == token)).first()
            return row is not None

    def user_from_token(self, token: str) -> dict[str, str]:
        if self._is_token_revoked(token):
            raise AuthError("Token has been revoked.")
        try:
            payload = jwt.decode(token, settings.auth_secret_key, algorithms=["HS256"])
            user_id = payload.get("sub")
            email = payload.get("email")
            if not isinstance(user_id, str) or not isinstance(email, str):
                raise AuthError("Invalid authentication token.")
            return {"id": user_id, "email": email}
        except (jwt.InvalidTokenError, AuthError) as exc:
            logger.warning("Token validation failed: %s", exc)
            raise AuthError("Invalid or expired authentication token.") from exc

    @staticmethod
    def _normalize_email(email: str) -> str:
        normalized = email.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise AuthError("Enter a valid email address.")
        return normalized

    @staticmethod
    def _hash_password(password: str) -> str:
        salt = secrets.token_bytes(16)
        digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
        return f"scrypt$16384$8$1${salt.hex()}${digest.hex()}"

    @staticmethod
    def _verify_password(password: str, encoded: str) -> bool:
        try:
            algorithm, n, r, p, salt_hex, digest_hex = encoded.split("$", 5)
            if algorithm != "scrypt":
                return False
            candidate = hashlib.scrypt(
                password.encode(),
                salt=bytes.fromhex(salt_hex),
                n=int(n),
                r=int(r),
                p=int(p),
            )
            return hmac.compare_digest(candidate.hex(), digest_hex)
        except (ValueError, TypeError):
            return False

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(UTC).isoformat()
