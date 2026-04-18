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
