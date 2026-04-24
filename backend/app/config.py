import os
from pathlib import Path


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _default_db_url() -> str:
    db_path = _project_root() / "database" / "app.db"
    return f"sqlite:///{db_path.as_posix()}"


_DEFAULT_CORS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
]


def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return list(_DEFAULT_CORS)
    extra = [x.strip() for x in raw.split(",") if x.strip()]
    merged = list(dict.fromkeys(_DEFAULT_CORS + extra))
    return merged


class Settings:
    project_root: Path = _project_root()
    database_url: str = os.getenv("DATABASE_URL", "").strip() or _default_db_url()
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-change-me-use-env-JWT_SECRET")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    uploads_dir: Path = _project_root() / "data" / "uploads" / "jobs"
    cors_allow_origins: list[str] = _parse_cors_origins()


settings = Settings()
