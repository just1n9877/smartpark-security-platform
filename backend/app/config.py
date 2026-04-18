import os
from pathlib import Path


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _default_db_url() -> str:
    db_path = _project_root() / "database" / "app.db"
    return f"sqlite:///{db_path.as_posix()}"


class Settings:
    project_root: Path = _project_root()
    database_url: str = os.getenv("DATABASE_URL", "").strip() or _default_db_url()
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-change-me-use-env-JWT_SECRET")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    uploads_dir: Path = _project_root() / "data" / "uploads" / "jobs"


settings = Settings()
