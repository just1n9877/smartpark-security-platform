from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    guard = "guard"


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class TrainingRunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class FeedbackLabel(str, enum.Enum):
    false_positive = "false_positive"
    delivery = "delivery"
    visitor = "visitor"
    work = "work"
    suspicious = "suspicious"
    other = "other"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False), default=UserRole.guard)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    feedbacks: Mapped[list[Feedback]] = relationship("Feedback", back_populates="user")


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128))
    rtsp_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    alerts: Mapped[list[Alert]] = relationship("Alert", back_populates="camera")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    video_path: Mapped[str] = mapped_column(String(1024))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, native_enum=False), default=JobStatus.pending)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    frame_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    frame_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    alerts: Mapped[list[Alert]] = relationship("Alert", back_populates="job")
    trajectory_points: Mapped[list[TrajectoryPoint]] = relationship(
        "TrajectoryPoint", back_populates="job", cascade="all, delete-orphan"
    )
    trajectory_summaries: Mapped[list[TrajectorySummary]] = relationship(
        "TrajectorySummary", back_populates="job", cascade="all, delete-orphan"
    )


class TrajectoryPoint(Base):
    __tablename__ = "trajectory_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="CASCADE"), index=True)
    frame_idx: Mapped[int] = mapped_column(Integer, index=True)
    track_id: Mapped[int] = mapped_column(Integer, index=True)
    cx: Mapped[float] = mapped_column(Float)
    cy: Mapped[float] = mapped_column(Float)
    w: Mapped[float] = mapped_column(Float)
    h: Mapped[float] = mapped_column(Float)
    ts: Mapped[float] = mapped_column(Float, doc="seconds from video start or monotonic stamp")

    job: Mapped[AnalysisJob] = relationship("AnalysisJob", back_populates="trajectory_points")


class TrajectorySummary(Base):
    __tablename__ = "trajectory_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="CASCADE"), index=True)
    track_id: Mapped[int] = mapped_column(Integer, index=True)
    features_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ml_scores_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    job: Mapped[AnalysisJob] = relationship("AnalysisJob", back_populates="trajectory_summaries")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int | None] = mapped_column(
        ForeignKey("analysis_jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    level: Mapped[str] = mapped_column(String(32), index=True)
    alert_type: Mapped[str] = mapped_column(String(64), index=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    track_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    keyframe_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)

    job: Mapped[AnalysisJob | None] = relationship("AnalysisJob", back_populates="alerts")
    camera: Mapped[Camera | None] = relationship("Camera", back_populates="alerts")
    feedbacks: Mapped[list[Feedback]] = relationship("Feedback", back_populates="alert")


class SystemConfig(Base):
    """单例行 id=1：流水线 + ML 阈值统一存 DB（YAML 仅作基准）；模型版本指针。"""

    __tablename__ = "system_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=1)
    consecutive_frames_for_escalation: Mapped[int] = mapped_column(Integer, default=4)
    dwell_warning_sec: Mapped[float] = mapped_column(Float, default=1.2)
    dwell_alert_sec: Mapped[float] = mapped_column(Float, default=3.0)
    cooldown_sec: Mapped[float] = mapped_column(Float, default=12.0)
    reversal_alert_k: Mapped[int] = mapped_column(Integer, default=4)
    feedback_window_n: Mapped[int] = mapped_column(Integer, default=20)
    high_fp_threshold: Mapped[float] = mapped_column(Float, default=0.4)
    max_consecutive_frames: Mapped[int] = mapped_column(Integer, default=12)
    # 统一策略：ML 与规则共用「敏感度」思想——误报高时同步抬升 M 与 ML 告警阈值
    ml_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    ml_iforest_min_anomaly_01: Mapped[float] = mapped_column(Float, default=0.55)
    ml_gru_min_anomaly_01: Mapped[float] = mapped_column(Float, default=0.5)
    ml_emit_separate_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    active_model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    retrain_on_feedback: Mapped[bool] = mapped_column(Boolean, default=False)
    retrain_feedback_delay_sec: Mapped[int] = mapped_column(Integer, default=10)
    retrain_interval_hours: Mapped[int] = mapped_column(Integer, default=0)
    last_scheduled_train_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    holdout_job_fraction: Mapped[float] = mapped_column(Float, default=0.2)
    rtsp_max_workers: Mapped[int] = mapped_column(Integer, default=4)
    stream_alert_merge_sec: Mapped[float] = mapped_column(Float, default=45.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class TrainingRun(Base):
    __tablename__ = "training_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    status: Mapped[TrainingRunStatus] = mapped_column(
        Enum(TrainingRunStatus, native_enum=False), default=TrainingRunStatus.pending
    )
    trigger: Mapped[str] = mapped_column(String(32), default="manual")
    version_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class EvaluationReport(Base):
    __tablename__ = "evaluation_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_json: Mapped[dict] = mapped_column(JSON)
    note: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    label: Mapped[FeedbackLabel] = mapped_column(Enum(FeedbackLabel, native_enum=False))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    alert: Mapped[Alert] = relationship("Alert", back_populates="feedbacks")
    user: Mapped[User] = relationship("User", back_populates="feedbacks")
