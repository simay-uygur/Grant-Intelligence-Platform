from pydantic_settings import BaseSettings, SettingsConfigDict


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
    ]
    use_mock_bedrock: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
