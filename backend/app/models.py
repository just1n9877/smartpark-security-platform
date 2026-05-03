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
    true_alert = "true_alert"
    false_positive = "false_positive"
    uncertain = "uncertain"
    delivery = "delivery"
    visitor = "visitor"
    work = "work"
    suspicious = "suspicious"
    other = "other"


class AlertLevel(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class SceneRuleType(str, enum.Enum):
    area = "area"
    line_crossing = "line_crossing"
    door = "door"
    direction = "direction"
    object_proximity = "object_proximity"


class PersonType(str, enum.Enum):
    employee = "employee"
    visitor = "visitor"
    contractor = "contractor"
    blacklist = "blacklist"
    unknown = "unknown"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False), default=UserRole.guard)
    full_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    department: Mapped[str | None] = mapped_column(String(128), nullable=True)
    title: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    feedbacks: Mapped[list[Feedback]] = relationship("Feedback", back_populates="user")


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sms_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    app_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    wechat_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="success", index=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class Person(Base):
    __tablename__ = "persons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128))
    person_type: Mapped[str] = mapped_column(String(32), default=PersonType.employee.value, index=True)
    employee_no: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    face_profiles: Mapped[list[FaceProfile]] = relationship(
        "FaceProfile", back_populates="person", cascade="all, delete-orphan"
    )
    authorizations: Mapped[list[PersonAuthorization]] = relationship(
        "PersonAuthorization", back_populates="person", cascade="all, delete-orphan"
    )


class FaceProfile(Base):
    __tablename__ = "face_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"), index=True)
    image_path: Mapped[str] = mapped_column(String(1024))
    embedding_json: Mapped[list] = mapped_column(JSON)
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    person: Mapped[Person] = relationship("Person", back_populates="face_profiles")


class PersonAuthorization(Base):
    __tablename__ = "person_authorizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"), index=True)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("scene_rules.id", ondelete="CASCADE"), nullable=True, index=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id", ondelete="CASCADE"), nullable=True, index=True)
    schedule_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    person: Mapped[Person] = relationship("Person", back_populates="authorizations")


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128))
    rtsp_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    risk_level: Mapped[int] = mapped_column(Integer, default=2)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    alerts: Mapped[list[Alert]] = relationship("Alert", back_populates="camera")
    scene_rules: Mapped[list[SceneRule]] = relationship("SceneRule", back_populates="camera")
    jobs: Mapped[list[AnalysisJob]] = relationship("AnalysisJob", back_populates="camera")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), index=True)
    device_type: Mapped[str] = mapped_column(String(32), default="server", index=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="online", index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cpu_percent: Mapped[float] = mapped_column(Float, default=0.0)
    memory_percent: Mapped[float] = mapped_column(Float, default=0.0)
    disk_percent: Mapped[float] = mapped_column(Float, default=0.0)
    uptime: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_check_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    video_path: Mapped[str] = mapped_column(String(1024))
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, native_enum=False), default=JobStatus.pending)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    frame_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    frame_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    camera: Mapped[Camera | None] = relationship("Camera", back_populates="jobs")
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
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
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
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    track_id: Mapped[int] = mapped_column(Integer, index=True)
    features_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ml_scores_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    job: Mapped[AnalysisJob] = relationship("AnalysisJob", back_populates="trajectory_summaries")


class SceneRule(Base):
    __tablename__ = "scene_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    rule_type: Mapped[str] = mapped_column(String(32), index=True)
    geometry: Mapped[dict] = mapped_column(JSON)
    risk_level: Mapped[int] = mapped_column(Integer, default=2)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    schedule_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    allowed_direction: Mapped[str | None] = mapped_column(String(32), nullable=True)
    dwell_threshold_sec: Mapped[float] = mapped_column(Float, default=8.0)
    config_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    camera: Mapped[Camera | None] = relationship("Camera", back_populates="scene_rules")


class ZoneTopology(Base):
    __tablename__ = "zone_topology"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    zone_a_id: Mapped[int] = mapped_column(ForeignKey("scene_rules.id", ondelete="CASCADE"), index=True)
    zone_b_id: Mapped[int] = mapped_column(ForeignKey("scene_rules.id", ondelete="CASCADE"), index=True)
    time_window_sec: Mapped[float] = mapped_column(Float, default=30.0)
    relation_type: Mapped[str] = mapped_column(String(64), default="adjacent")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class TargetTrack(Base):
    __tablename__ = "target_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    global_track_id: Mapped[str] = mapped_column(String(128), index=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    local_track_id: Mapped[int] = mapped_column(Integer, index=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class TrackIdentity(Base):
    __tablename__ = "track_identities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    track_id: Mapped[int] = mapped_column(Integer, index=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("persons.id", ondelete="SET NULL"), nullable=True, index=True)
    identity_status: Mapped[str] = mapped_column(String(32), default="unknown", index=True)
    authorization_status: Mapped[str] = mapped_column(String(32), default="unknown", index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime)
    evidence_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    details_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class FaceRecognitionLog(Base):
    __tablename__ = "face_recognition_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    track_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("persons.id", ondelete="SET NULL"), nullable=True, index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default="unknown", index=True)
    snapshot_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class AtomicEvent(Base):
    __tablename__ = "atomic_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("scene_rules.id", ondelete="SET NULL"), nullable=True, index=True)
    track_id: Mapped[int] = mapped_column(Integer, index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    event_ts: Mapped[float] = mapped_column(Float, index=True)
    event_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class CompoundEvent(Base):
    __tablename__ = "compound_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("scene_rules.id", ondelete="SET NULL"), nullable=True, index=True)
    track_id: Mapped[int] = mapped_column(Integer, index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    event_ts: Mapped[float] = mapped_column(Float, index=True)
    event_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    reason_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int | None] = mapped_column(
        ForeignKey("analysis_jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    level: Mapped[str] = mapped_column(String(32), index=True)
    alert_type: Mapped[str] = mapped_column(String(64), index=True)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("scene_rules.id", ondelete="SET NULL"), nullable=True, index=True)
    compound_event_id: Mapped[int | None] = mapped_column(ForeignKey("compound_events.id", ondelete="SET NULL"), nullable=True, index=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    track_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    keyframe_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    evidence_clip_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)

    job: Mapped[AnalysisJob | None] = relationship("AnalysisJob", back_populates="alerts")
    camera: Mapped[Camera | None] = relationship("Camera", back_populates="alerts")
    feedbacks: Mapped[list[Feedback]] = relationship("Feedback", back_populates="alert")
    correlations: Mapped[list[AlertCorrelation]] = relationship(
        "AlertCorrelation", foreign_keys="AlertCorrelation.primary_alert_id", back_populates="primary_alert"
    )


class AlertCorrelation(Base):
    __tablename__ = "alert_correlations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    primary_alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), index=True)
    related_alert_id: Mapped[int | None] = mapped_column(ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True, index=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    relation_type: Mapped[str] = mapped_column(String(64), default="enhancement")
    details_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    primary_alert: Mapped[Alert] = relationship(
        "Alert", foreign_keys=[primary_alert_id], back_populates="correlations"
    )


class SystemConfig(Base):
    """单例行 id=1：流水线 + ML 阈值统一存 DB（YAML 仅作基准）；模型版本指针。"""

    __tablename__ = "system_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=1)
    consecutive_frames_for_escalation: Mapped[int] = mapped_column(Integer, default=6)
    dwell_warning_sec: Mapped[float] = mapped_column(Float, default=1.2)
    dwell_alert_sec: Mapped[float] = mapped_column(Float, default=3.0)
    cooldown_sec: Mapped[float] = mapped_column(Float, default=60.0)
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    alert: Mapped[Alert] = relationship("Alert", back_populates="feedbacks")
    user: Mapped[User] = relationship("User", back_populates="feedbacks")


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
