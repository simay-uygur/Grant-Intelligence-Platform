from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
import json


class Settings(BaseSettings):
    app_name: str = "Grant Intelligence Backend"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    debug: bool = True
    sqlite_db_path: str = "storage/backend.db"

    # Default fallback is "local" (SQLite / browser storage).
    # When deployed to AWS Lightsail, the Lightsail container secret / environment variable
    # SESSION_STORAGE_TYPE=hosted automatically overrides this value to "hosted" (RDS / Cloud DB).
    session_storage_type: str = "local"  # "local" (SQLite/browser) or "hosted" (RDS/Cloud DB)
    database_url: str | None = None  # Hosted DB connection string (e.g., postgresql://user:pass@host:5432/dbname)
    chat_history_window: int = 10
    frontend_cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]
    use_mock_bedrock: bool = Field(default=False, validation_alias="USE_MOCK_BEDROCK")
    aws_region: str = Field(default="us-east-1", validation_alias="AWS_REGION")
    bedrock_model_id: str = Field(
        default="us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        validation_alias="BEDROCK_MODEL_ID",
    )
    auth_required: bool = False
    auth_secret_key: str = "development-only-secret-change-before-hosting-9f4c2e7a"
    auth_token_ttl_hours: int = 168

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("frontend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [x.strip() for x in v.split(",")]
        return v


settings = Settings()
