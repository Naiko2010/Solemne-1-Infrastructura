from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import Optional

_DEV_ORIGIN_PATTERNS = ("localhost", "127.0.0.1", "host.docker.internal")


class Settings(BaseSettings):
    # App
    app_env: str = "development"
    app_host: str = "localhost"
    app_port: int = 8000
    app_debug: bool = False

    # CORS (incluye 127.0.0.1: el navegador trata localhost y 127.0.0.1 como orígenes distintos)
    # Override via CORS_ORIGINS env var (docker-compose.dev.yml adds host.docker.internal variants)
    # Non-dev envs must set CORS_ORIGINS explicitly to https:// domains only.
    cors_origins: str = (
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,"
        "http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174"
    )

    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_service_role_key: Optional[str] = None

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_audience: Optional[str] = "authenticated"
    access_token_expire_minutes: int = 480

    # Admin
    sync_metadata_key: str = "sync-metadata-key-change-this"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore unknown env vars

    @model_validator(mode="after")
    def validate_cors_for_env(self) -> "Settings":
        if self.app_env == "development":
            return self
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        dev_origins = [o for o in origins if any(pat in o for pat in _DEV_ORIGIN_PATTERNS)]
        if dev_origins:
            raise ValueError(
                f"Dev origins not allowed in APP_ENV={self.app_env!r}: {dev_origins}. "
                "Set CORS_ORIGINS to production/staging https:// domains only."
            )
        if self.app_env == "production":
            if not origins:
                raise ValueError(
                    "CORS_ORIGINS must not be empty in production. "
                    "Set it to your https:// domain(s)."
                )
            insecure = [o for o in origins if not o.startswith("https://")]
            if insecure:
                raise ValueError(
                    f"Production CORS_ORIGINS must use https:// only. Got: {insecure}"
                )
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
