from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./data/datrix.db"

    # ── JWT Auth ──────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── App ───────────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ── Storage ───────────────────────────────────────────────────────────────
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_MB: int = 10240
    STORAGE_BACKEND: str = "local"   # "local" | "s3"

    # ── S3 / R2 / B2 / MinIO (only used when STORAGE_BACKEND=s3) ────────────────
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "auto"
    AWS_S3_PREFIX: str = "uploads/"
    # For Cloudflare R2: https://<account-id>.r2.cloudflarestorage.com
    # For MinIO:         http://localhost:9000
    # For real AWS S3:   leave blank
    AWS_ENDPOINT_URL: str = ""
    # Credentials: leave blank to fall back to env / instance role / ~/.aws
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # ── OAuth providers ───────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    # Base URL the backend is reachable at — used to build OAuth redirect_uri
    APP_URL: str = "http://localhost:8000"
    # Frontend origin — where to send users after OAuth completes
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Email / SMTP (leave blank to log emails to console in dev) ───────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    FROM_EMAIL: str = "noreply@datrix.ai"
    FROM_NAME: str = "Datrix"

    # ── Observability ─────────────────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None

    # ── Computed ──────────────────────────────────────────────────────────────
    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def allowed_extensions(self) -> set[str]:
        return {".csv", ".json", ".jsonl", ".parquet", ".xlsx", ".xls"}

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024


settings = Settings()

# ── Backwards-compatible module-level constants ───────────────────────────────
# Existing service files import these directly; keep them working.
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

UPLOADS_DIR = settings.upload_path
ALLOWED_EXTENSIONS = settings.allowed_extensions
MAX_UPLOAD_BYTES = settings.max_upload_bytes
