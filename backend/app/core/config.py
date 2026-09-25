"""Application configuration loaded from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg2://meditrack:meditrack@localhost:5432/meditrack"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # App
    project_name: str = "MediTrack API"
    api_v1_prefix: str = "/api"

    # Live simulation engine — off by default so platform starts blank.
    # An admin can start it from the dashboard simulation panel.
    simulator_autostart: bool = False
    simulator_interval_seconds: float = 3.0


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
