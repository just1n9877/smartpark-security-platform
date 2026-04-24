from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _sqlite_add_column(table: str, coldef: str) -> None:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns(table)}
    name = coldef.split()[0].strip()
    if name in cols:
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {coldef}"))


def ensure_sqlite_migrations() -> None:
    """为已有 SQLite 库补列/兼容升级。"""
    if not str(engine.url).startswith("sqlite"):
        return
    insp = inspect(engine)
    if "alerts" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("alerts")}
    if "job_id" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN job_id INTEGER"))

    if "trajectory_summaries" in insp.get_table_names():
        tcols = {c["name"] for c in insp.get_columns("trajectory_summaries")}
        if "ml_scores_json" not in tcols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE trajectory_summaries ADD COLUMN ml_scores_json TEXT"))

    _sqlite_add_column("analysis_jobs", "frame_width INTEGER")
    _sqlite_add_column("analysis_jobs", "frame_height INTEGER")

    sc_cols = [
        ("ml_enabled", "INTEGER DEFAULT 1"),
        ("ml_iforest_min_anomaly_01", "REAL DEFAULT 0.55"),
        ("ml_gru_min_anomaly_01", "REAL DEFAULT 0.5"),
        ("ml_emit_separate_alerts", "INTEGER DEFAULT 1"),
        ("active_model_version", "VARCHAR(64)"),
        ("retrain_on_feedback", "INTEGER DEFAULT 0"),
        ("retrain_feedback_delay_sec", "INTEGER DEFAULT 10"),
        ("retrain_interval_hours", "INTEGER DEFAULT 0"),
        ("last_scheduled_train_at", "DATETIME"),
        ("holdout_job_fraction", "REAL DEFAULT 0.2"),
        ("rtsp_max_workers", "INTEGER DEFAULT 4"),
        ("stream_alert_merge_sec", "REAL DEFAULT 45.0"),
    ]
    for name, typ in sc_cols:
        _sqlite_add_column("system_configs", f"{name} {typ}")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
