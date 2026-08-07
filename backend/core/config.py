from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
import json


class Settings(BaseSettings):
    app_name: str = "Grant Intelligence Backend"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    debug: bool = True
    sqlite_db_path: str = "storage/backend.db"
    chat_history_window: int = 10
    frontend_cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]
    use_mock_bedrock: bool = True

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
