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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    id: int
    username: str
    role: UserRole

    model_config = {"from_attributes": True}


class CameraCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    rtsp_url: str | None = None
    notes: str | None = None


class CameraOut(BaseModel):
    id: int
    name: str
    rtsp_url: str | None
    notes: str | None
    created_at: UtcIsoZ

    model_config = {"from_attributes": True}


class JobOut(BaseModel):
    id: int
    video_path: str
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


class AlertOut(BaseModel):
    id: int
    job_id: int | None = None
    level: str
    alert_type: str
    triggered_at: UtcIsoZ
    track_id: int | None
    camera_id: int | None
    keyframe_path: str | None
    is_confirmed: bool

    model_config = {"from_attributes": True}


class AlertDetail(AlertOut):
    pass


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

    model_config = {"from_attributes": True}


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


class SettingsOut(BaseModel):
    effective: PipelineSettingsBlock
    yaml_baseline: PipelineSettingsBlock
    tuning: TuningParamsOut
    feedback_rollup: FeedbackRollupOut


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
