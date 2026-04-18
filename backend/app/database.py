from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_sqlite_migrations() -> None:
    """为已有 SQLite 库补列（如 alerts.job_id），供 API 与独立脚本共用。"""
    if not str(engine.url).startswith("sqlite"):
        return
    insp = inspect(engine)
    if "alerts" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("alerts")}
    if "job_id" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN job_id INTEGER"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
