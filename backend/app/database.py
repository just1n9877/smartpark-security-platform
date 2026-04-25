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
    tables = set(insp.get_table_names())
    if "users" in tables:
        _sqlite_add_column("users", "email VARCHAR(255)")
    if "cameras" in tables:
        _sqlite_add_column("cameras", "location VARCHAR(255)")
        _sqlite_add_column("cameras", "risk_level INTEGER DEFAULT 2")
        _sqlite_add_column("cameras", "is_active INTEGER DEFAULT 1")
    if "analysis_jobs" in tables:
        _sqlite_add_column("analysis_jobs", "camera_id INTEGER")
    if "trajectory_points" in tables:
        _sqlite_add_column("trajectory_points", "camera_id INTEGER")
    if "trajectory_summaries" in tables:
        _sqlite_add_column("trajectory_summaries", "camera_id INTEGER")
    if "feedbacks" in tables:
        _sqlite_add_column("feedbacks", "updated_at DATETIME")
    if "persons" in tables:
        _sqlite_add_column("persons", "employee_no VARCHAR(64)")
        _sqlite_add_column("persons", "email VARCHAR(255)")
        _sqlite_add_column("persons", "phone VARCHAR(64)")
        _sqlite_add_column("persons", "notes TEXT")
        _sqlite_add_column("persons", "is_active INTEGER DEFAULT 1")
    if "track_identities" in tables:
        _sqlite_add_column("track_identities", "authorization_status VARCHAR(32) DEFAULT 'unknown'")
        _sqlite_add_column("track_identities", "evidence_path VARCHAR(1024)")
        _sqlite_add_column("track_identities", "details_json TEXT")
    if "alerts" not in tables:
        return
    cols = {c["name"] for c in insp.get_columns("alerts")}
    if "job_id" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN job_id INTEGER"))
    alert_cols = [
        ("rule_id", "INTEGER"),
        ("compound_event_id", "INTEGER"),
        ("evidence_clip_path", "VARCHAR(1024)"),
        ("reason", "TEXT"),
        ("reason_json", "TEXT"),
    ]
    for name, typ in alert_cols:
        _sqlite_add_column("alerts", f"{name} {typ}")

    if "trajectory_summaries" in tables:
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
