from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models import FeedbackLabel, JobStatus, UserRole


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
    created_at: datetime

    model_config = {"from_attributes": True}


class JobOut(BaseModel):
    id: int
    video_path: str
    status: JobStatus
    error_message: str | None
    created_at: datetime

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
    triggered_at: datetime
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
    created_at: datetime

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
