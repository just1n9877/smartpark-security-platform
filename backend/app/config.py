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
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "").strip()
    deepseek_api_url: str = os.getenv(
        "DEEPSEEK_API_URL",
        "https://api.deepseek.com/chat/completions",
    ).strip()
    deepseek_model: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip()
    deepseek_timeout_sec: float = float(os.getenv("DEEPSEEK_TIMEOUT_SEC", "30"))
    deepseek_temperature: float = float(os.getenv("DEEPSEEK_TEMPERATURE", "0.3"))
    mediamtx_enabled: bool = os.getenv("MEDIAMTX_ENABLED", "true").strip().lower() not in {"0", "false", "no"}
    mediamtx_api_url: str = os.getenv("MEDIAMTX_API_URL", "http://127.0.0.1:9997").strip().rstrip("/")
    mediamtx_public_webrtc_url: str = os.getenv(
        "MEDIAMTX_PUBLIC_WEBRTC_URL",
        "http://127.0.0.1:8889",
    ).strip().rstrip("/")
    mediamtx_timeout_sec: float = float(os.getenv("MEDIAMTX_TIMEOUT_SEC", "5"))


settings = Settings()
