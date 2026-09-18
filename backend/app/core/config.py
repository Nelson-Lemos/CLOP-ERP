from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "CLOP Management"
    PROJECT_DESCRIPTION: str = "Sistema de Gestão Empresarial e Produtividade"
    VERSION: str = "0.1.0"

    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:5173"
    UPLOAD_DIR: str = "uploads"
    DEFAULT_AVATAR: str = "/branding/avatar-default.svg"
    OVERDUE_SCAN_INTERVAL_SECONDS: int = 120

    SEED_ADMIN_EMAIL: str = "admin@clop.academy"
    SEED_ADMIN_PASSWORD: str = "ChangeMe_2026!"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()