"""Simplified configuration management."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_APP_NAME = "OpenPoke Server"
DEFAULT_APP_VERSION = "0.3.0"

# In monorepo: apps/server/config.py -> ../../.env
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"


class Settings(BaseSettings):
    """Application settings with pydantic-settings env validation."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH) if _ENV_PATH.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App metadata
    app_name: str = Field(default=DEFAULT_APP_NAME)
    app_version: str = Field(default=DEFAULT_APP_VERSION)

    # Server runtime (no env vars, set via CLI)
    server_host: str = Field(default="0.0.0.0")
    server_port: int = Field(default=8001)

    # LLM model selection
    interaction_agent_model: str = Field(default="openai/gpt-5-mini")
    execution_agent_model: str = Field(default="openai/gpt-5-mini")
    execution_agent_search_model: str = Field(default="openai/gpt-5-mini")
    summarizer_model: str = Field(default="openai/gpt-5-mini")
    email_classifier_model: str = Field(default="openai/gpt-5-mini")

    # AI API Keys
    openrouter_api_key: str | None = None

    # Better Auth
    better_auth_secret: str | None = None

    # Composio (Gmail Integration)
    composio_api_key: str | None = None
    composio_gmail_auth_config_id: str | None = None
    frontend_url: str = Field(default="http://localhost:3000")
    next_public_py_backend_url: str = Field(default="http://localhost:8001")

    # Database (MySQL)
    database_host: str = ""
    database_username: str = ""
    database_password: str = ""
    database_name: str = Field(default="openpoke")

    # Rate Limiting
    upstash_redis_rest_url: str | None = None
    upstash_redis_rest_token: str | None = None

    # HTTP behaviour (internal only, no env var)
    cors_allow_origins_raw: str = Field(default="*")

    # Summarisation controls (internal only, no env vars)
    conversation_summary_threshold: int = Field(default=100)
    conversation_summary_tail_size: int = Field(default=10)

    @property
    def cors_allow_origins(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if self.cors_allow_origins_raw.strip() in {"", "*"}:
            return ["*"]
        return [origin.strip() for origin in self.cors_allow_origins_raw.split(",") if origin.strip()]

    @property
    def summarization_enabled(self) -> bool:
        """Flag indicating conversation summarisation is active."""
        return self.conversation_summary_threshold > 0

    @property
    def database_url(self) -> str:
        """Build MySQL connection URL (sync driver for SQLAlchemy)."""
        if not all([self.database_host, self.database_username, self.database_password]):
            return ""
        return f"mysql+pymysql://{self.database_username}:{self.database_password}@{self.database_host}/{self.database_name}"

    @property
    def database_url_async(self) -> str:
        """Build async MySQL connection URL (for aiomysql)."""
        if not all([self.database_host, self.database_username, self.database_password]):
            return ""
        return f"mysql+aiomysql://{self.database_username}:{self.database_password}@{self.database_host}/{self.database_name}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
