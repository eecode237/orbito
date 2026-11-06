"""ORBITO application configuration.

Every knob is an environment variable (see the repository `.env.example`).
Nothing in the codebase should read os.environ directly — import `settings`.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = API_DIR.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(API_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- application -------------------------------------------------------
    app_name: str = "ORBITO"
    app_env: str = "development"
    app_version: str = "0.1.0"
    app_secret_key: str = "dev-only-secret-change-me"
    app_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"
    demo_user_email: str = "you@orbito.local"

    # --- persistence -------------------------------------------------------
    database_url: str = "sqlite+aiosqlite:///./.data/orbito.db"
    redis_url: str | None = None

    # --- providers ---------------------------------------------------------
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    anthropic_api_key: str | None = None
    anthropic_base_url: str = "https://api.anthropic.com"
    google_api_key: str | None = None
    google_base_url: str = "https://generativelanguage.googleapis.com"
    mistral_api_key: str | None = None
    mistral_base_url: str = "https://api.mistral.ai/v1"
    ollama_base_url: str = "http://localhost:11434"

    # --- tools -------------------------------------------------------------
    tavily_api_key: str | None = None
    serper_api_key: str | None = None

    # --- model roles (override registry entries) ---------------------------
    orbito_default_model: str = "fast"
    orbito_planning_model: str = "reasoning"
    orbito_reasoning_model: str | None = None
    orbito_coding_model: str | None = None
    orbito_fast_model: str | None = None
    orbito_vision_model: str | None = None
    orbito_smart_model: str | None = None

    # --- gateway behaviour -------------------------------------------------
    model_request_timeout: float = 90.0
    model_max_retries: int = 1
    model_temperature: float = 0.4
    model_max_tokens: int = 2048
    allow_mock_fallback: bool = True

    # --- scraping ----------------------------------------------------------
    scraping_max_pages: int = 100
    scraping_concurrency: int = 3
    scraping_max_depth: int = 3
    scraping_allowed_domains: str = ""
    scraping_timeout: float = 20.0

    # --- storage -----------------------------------------------------------
    s3_endpoint: str | None = None
    s3_bucket: str = "orbito"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_region: str = "auto"
    upload_dir: str = "./.data/uploads"

    # --- voice / observability --------------------------------------------
    livekit_url: str | None = None
    livekit_api_key: str | None = None
    livekit_api_secret: str | None = None
    otel_exporter_otlp_endpoint: str | None = None

    @field_validator("app_cors_origins")
    @classmethod
    def _strip_origins(cls, value: str) -> str:
        return value.strip()

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.app_cors_origins.split(",") if origin.strip()]

    @property
    def is_dev(self) -> bool:
        return self.app_env.lower() in {"development", "dev", "local", "test"}

    @property
    def allowed_scrape_domains(self) -> list[str]:
        return [
            domain.strip().lower()
            for domain in self.scraping_allowed_domains.split(",")
            if domain.strip()
        ]

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        return path if path.is_absolute() else API_DIR / path


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
