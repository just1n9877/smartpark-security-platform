from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, PlainSerializer, WithJsonSchema

from app.models import FeedbackLabel, JobStatus, UserRole


def _ensure_utc_datetime(v: Any) -> datetime:
    """SQLite 等来源常为 naive datetime：按 UTC 解释，便于前端正确换算本地时区。"""
    if not isinstance(v, datetime):
        return v
    if v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc)


def _utc_to_iso_z(v: datetime) -> str:
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    else:
        v = v.astimezone(timezone.utc)
    iso = v.isoformat()
    if iso.endswith("+00:00"):
        return iso[:-6] + "Z"
    return iso if iso.endswith("Z") else iso + "Z"


UtcIsoZ = Annotated[
    datetime,
    BeforeValidator(_ensure_utc_datetime),
    PlainSerializer(_utc_to_iso_z, when_used="json"),
    WithJsonSchema({"type": "string", "format": "date-time"}),
]


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    id: int
    username: str
    email: str | None = None
    role: UserRole

    model_config = {"from_attributes": True}


class CameraCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    rtsp_url: str | None = None
    location: str | None = None
    risk_level: int = Field(default=2, ge=1, le=5)
    is_active: bool = True
    notes: str | None = None


class CameraUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    rtsp_url: str | None = None
    location: str | None = None
    risk_level: int | None = Field(default=None, ge=1, le=5)
    is_active: bool | None = None
    notes: str | None = None


class CameraOut(BaseModel):
    id: int
    name: str
    rtsp_url: str | None
    location: str | None = None
    risk_level: int = 2
    is_active: bool = True
    notes: str | None
    created_at: UtcIsoZ

    model_config = {"from_attributes": True}


class JobOut(BaseModel):
    id: int
    video_path: str
    camera_id: int | None = None
    status: JobStatus
    error_message: str | None
    created_at: UtcIsoZ

    model_config = {"from_attributes": True}


class JobDetail(JobOut):
    trajectory_points_count: int = 0
    trajectory_summaries_count: int = 0
    alerts_count: int = 0


class RunLocalPathBody(BaseModel):
    path: str = Field(..., min_length=1, description="本地视频绝对或相对路径")
    camera_id: int | None = None


class SceneRuleBase(BaseModel):
    camera_id: int | None = None
    name: str = Field(..., min_length=1, max_length=128)
    rule_type: str = Field(
        ...,
        description="area | line_crossing | door | direction | object_proximity",
    )
    geometry: dict[str, Any]
    risk_level: int = Field(default=2, ge=1, le=5)
    is_enabled: bool = True
    schedule_json: dict[str, Any] | None = None
    allowed_direction: str | None = None
    dwell_threshold_sec: float = Field(default=8.0, gt=0, le=3600)
    config_json: dict[str, Any] | None = None


class SceneRuleCreate(SceneRuleBase):
    pass


class SceneRuleUpdate(BaseModel):
    camera_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=128)
    rule_type: str | None = None
    geometry: dict[str, Any] | None = None
    risk_level: int | None = Field(default=None, ge=1, le=5)
    is_enabled: bool | None = None
    schedule_json: dict[str, Any] | None = None
    allowed_direction: str | None = None
    dwell_threshold_sec: float | None = Field(default=None, gt=0, le=3600)
    config_json: dict[str, Any] | None = None


class SceneRuleOut(SceneRuleBase):
    id: int
    created_at: UtcIsoZ

    model_config = {"from_attributes": True}


class ZoneTopologyCreate(BaseModel):
    zone_a_id: int
    zone_b_id: int
    time_window_sec: float = Field(default=30.0, gt=0, le=3600)
    relation_type: str = "adjacent"


class ZoneTopologyOut(ZoneTopologyCreate):
    id: int
    created_at: UtcIsoZ

    model_config = {"from_attributes": True}


class PersonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    person_type: str = Field(default="employee", description="employee | visitor | contractor | blacklist")
    employee_no: str | None = None
    email: str | None = None
    phone: str | None = None
    notes: str | None = None
    is_active: bool = True


class PersonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    person_type: str | None = None
    employee_no: str | None = None
    email: str | None = None
    phone: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class FaceProfileOut(BaseModel):
    id: int
    person_id: int
    image_path: str
    quality_score: float
    is_active: bool
    created_at: UtcIsoZ

    model_config = {"from_attributes": True}


class PersonAuthorizationCreate(BaseModel):
    person_id: int
    rule_id: int | None = None
    camera_id: int | None = None
    schedule_json: dict[str, Any] | None = None
    is_enabled: bool = True


class PersonAuthorizationOut(PersonAuthorizationCreate):
    id: int
    created_at: UtcIsoZ

    model_config = {"from_attributes": True}


class PersonOut(PersonCreate):
    id: int
    created_at: UtcIsoZ
    face_profiles: list[FaceProfileOut] = Field(default_factory=list)
    authorizations: list[PersonAuthorizationOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class FaceRecognitionLogOut(BaseModel):
    id: int
    job_id: int | None = None
    camera_id: int | None = None
    track_id: int | None = None
    person_id: int | None = None
    confidence: float
    status: str
    snapshot_path: str | None = None
    created_at: UtcIsoZ

    model_config = {"from_attributes": True}


class TrackIdentityOut(BaseModel):
    id: int
    job_id: int | None = None
    camera_id: int | None = None
    track_id: int
    person_id: int | None = None
    identity_status: str
    authorization_status: str
    confidence: float
    first_seen_at: UtcIsoZ
    last_seen_at: UtcIsoZ
    evidence_path: str | None = None
    details_json: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class AlertOut(BaseModel):
    id: int
    job_id: int | None = None
    level: str
    alert_type: str
    rule_id: int | None = None
    compound_event_id: int | None = None
    triggered_at: UtcIsoZ
    track_id: int | None
    camera_id: int | None
    keyframe_path: str | None
    evidence_clip_path: str | None = None
    reason: str | None = None
    reason_json: dict[str, Any] | None = None
    is_confirmed: bool
    trajectory_features: dict[str, Any] | None = None
    ml_scores: dict[str, Any] | None = None
    ai_combined_score: float | None = Field(
        None, description="轨迹 ML+DL 综合异常分 0–1，高=更偏离园区正常模式"
    )

    model_config = {"from_attributes": True}


class FeedbackCreate(BaseModel):
    label: FeedbackLabel
    note: str | None = None


class FeedbackOut(BaseModel):
    id: int
    alert_id: int
    user_id: int
    label: FeedbackLabel
    note: str | None
    created_at: UtcIsoZ
    updated_at: UtcIsoZ | None = None

    model_config = {"from_attributes": True}


class AlertDetail(AlertOut):
    feedback: FeedbackOut | None = None
    correlations: list[dict[str, Any]] = Field(default_factory=list)


class FeedbackResult(BaseModel):
    feedback: FeedbackOut
    message: str = "ok"


class DayCount(BaseModel):
    date: str
    count: int


class DashboardSummary(BaseModel):
    """大屏与统计：今日告警、近 7 日趋势、反馈误报占比、任务/设备概况。"""

    alerts_today: int
    alerts_by_day_7d: list[DayCount]
    feedback_false_positive_rate: float | None = None
    feedback_total: int
    jobs_by_status: dict[str, int]
    cameras_count: int
    recent_jobs_count: int


class PipelineSettingsBlock(BaseModel):
    """与 `config/pipeline_alerts.yaml` debounce / early_warning 对齐的生效项。"""

    consecutive_frames_for_escalation: int
    dwell_warning_sec: float
    dwell_alert_sec: float
    cooldown_sec: float
    reversal_alert_k: int


class TuningParamsOut(BaseModel):
    feedback_window_n: int
    high_fp_threshold: float
    max_consecutive_frames: int
    updated_at: UtcIsoZ


class FeedbackRollupStats(BaseModel):
    sample_size: int
    false_positives: int
    false_positive_rate: float | None = None


class CameraFeedbackRollup(BaseModel):
    camera_id: int | None = None
    camera_name: str
    sample_size: int
    false_positives: int
    false_positive_rate: float | None = None


class FeedbackRollupOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    window_n: int
    global_stats: FeedbackRollupStats = Field(
        validation_alias="global",
        serialization_alias="global",
    )
    by_camera: list[CameraFeedbackRollup]


class UnifiedMlPolicyOut(BaseModel):
    """规则 + ML 统一策略（DB 为权威源）。"""

    ml_enabled: bool
    ml_iforest_min_anomaly_01: float
    ml_gru_min_anomaly_01: float
    ml_emit_separate_alerts: bool
    active_model_version: str | None = None
    retrain_on_feedback: bool
    retrain_feedback_delay_sec: int
    retrain_interval_hours: int
    holdout_job_fraction: float
    rtsp_max_workers: int
    stream_alert_merge_sec: float


class SettingsOut(BaseModel):
    effective: PipelineSettingsBlock
    yaml_baseline: PipelineSettingsBlock
    tuning: TuningParamsOut
    feedback_rollup: FeedbackRollupOut
    unified_ml: UnifiedMlPolicyOut


class SettingsPatch(BaseModel):
    """admin：手动改参或一键恢复 YAML 基准。"""

    reset_to_yaml_defaults: bool = False
    consecutive_frames_for_escalation: int | None = Field(default=None, ge=2, le=30)
    dwell_warning_sec: float | None = Field(default=None, gt=0, le=3600)
    dwell_alert_sec: float | None = Field(default=None, gt=0, le=3600)
    cooldown_sec: float | None = Field(default=None, gt=0, le=86400)
    reversal_alert_k: int | None = Field(default=None, ge=1, le=100)
    feedback_window_n: int | None = Field(default=None, ge=5, le=500)
    high_fp_threshold: float | None = Field(default=None, ge=0.05, le=0.95)
    max_consecutive_frames: int | None = Field(default=None, ge=3, le=30)
    ml_enabled: bool | None = None
    ml_iforest_min_anomaly_01: float | None = Field(default=None, ge=0.05, le=0.99)
    ml_gru_min_anomaly_01: float | None = Field(default=None, ge=0.05, le=0.99)
    ml_emit_separate_alerts: bool | None = None
    retrain_on_feedback: bool | None = None
    retrain_feedback_delay_sec: int | None = Field(default=None, ge=0, le=86400)
    retrain_interval_hours: int | None = Field(default=None, ge=0, le=168)
    holdout_job_fraction: float | None = Field(default=None, ge=0.05, le=0.5)
    rtsp_max_workers: int | None = Field(default=None, ge=1, le=32)
    stream_alert_merge_sec: float | None = Field(default=None, ge=5, le=600)


class TrainingRunOut(BaseModel):
    id: int
    status: str
    trigger: str
    version_id: str | None = None
    message: str | None = None
    meta_json: dict[str, Any] | None = None
    created_at: UtcIsoZ
    finished_at: UtcIsoZ | None = None

    model_config = {"from_attributes": True}


class EvaluationReportOut(BaseModel):
    id: int
    report_json: dict[str, Any]
    note: str | None = None
    created_at: UtcIsoZ

    model_config = {"from_attributes": True}


class TrajectoryPoint2D(BaseModel):
    frame_idx: int
    cx: float
    cy: float


class AlertTrajectoryOut(BaseModel):
    alert_id: int
    job_id: int | None = None
    track_id: int | None = None
    frame_width: int
    frame_height: int
    points: list[TrajectoryPoint2D]
    narrative: str
    alert_type: str | None = None


class AssistantRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class AssistantResponse(BaseModel):
    answer: str
    suggestions: list[str] = Field(default_factory=list)
    source: str = "local_rules"


class AtomicEventOut(BaseModel):
    id: int
    job_id: int | None = None
    camera_id: int | None = None
    rule_id: int | None = None
    track_id: int
    event_type: str
    event_ts: float
    event_at: UtcIsoZ
    payload_json: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class CompoundEventOut(BaseModel):
    id: int
    job_id: int | None = None
    camera_id: int | None = None
    rule_id: int | None = None
    track_id: int
    event_type: str
    event_ts: float
    event_at: UtcIsoZ
    reason_json: dict[str, Any] | None = None
    is_open: bool

    model_config = {"from_attributes": True}


class ActivateModelBody(BaseModel):
    version_id: str = Field(..., min_length=2, max_length=64)
