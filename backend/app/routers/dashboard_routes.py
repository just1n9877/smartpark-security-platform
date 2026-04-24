"""聚合统计：供管理端大屏图表使用。"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import cast, func
from sqlalchemy.orm import Session
from sqlalchemy.types import Date

from app.database import get_db
from app.deps import get_current_user
from app.models import Alert, AnalysisJob, Camera, EvaluationReport, Feedback, FeedbackLabel, JobStatus, User
from app.schemas import DashboardSummary, DayCount, EvaluationReportOut

router = APIRouter()


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DashboardSummary:
    today = _utc_today()
    alerts_today = (
        db.query(Alert)
        .filter(cast(Alert.triggered_at, Date) == today)
        .count()
    )

    start_7d = today - timedelta(days=6)
    rows = (
        db.query(cast(Alert.triggered_at, Date).label("d"), func.count(Alert.id))
        .filter(cast(Alert.triggered_at, Date) >= start_7d)
        .group_by(cast(Alert.triggered_at, Date))
        .all()
    )
    by_day = {r[0]: r[1] for r in rows if r[0] is not None}
    alerts_by_day_7d: list[DayCount] = []
    for i in range(7):
        d = start_7d + timedelta(days=i)
        alerts_by_day_7d.append(DayCount(date=d.isoformat(), count=int(by_day.get(d, 0))))

    fb_total = db.query(Feedback).count()
    fp = db.query(Feedback).filter(Feedback.label == FeedbackLabel.false_positive).count()
    feedback_false_positive_rate: float | None
    if fb_total == 0:
        feedback_false_positive_rate = None
    else:
        feedback_false_positive_rate = round(fp / fb_total, 4)

    jobs_by_status: dict[str, int] = {}
    for st in JobStatus:
        jobs_by_status[st.value] = db.query(AnalysisJob).filter(AnalysisJob.status == st).count()

    cameras_count = db.query(Camera).count()
    recent_jobs_count = db.query(AnalysisJob).count()

    return DashboardSummary(
        alerts_today=alerts_today,
        alerts_by_day_7d=alerts_by_day_7d,
        feedback_false_positive_rate=feedback_false_positive_rate,
        feedback_total=fb_total,
        jobs_by_status=jobs_by_status,
        cameras_count=cameras_count,
        recent_jobs_count=recent_jobs_count,
    )


@router.get("/metrics")
def dashboard_metrics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Holdout 评测历史 + 按摄像头/离线桶告警计数（可度量降误报）。"""
    latest = db.query(EvaluationReport).order_by(EvaluationReport.created_at.desc()).first()
    hist = (
        db.query(EvaluationReport)
        .order_by(EvaluationReport.created_at.desc())
        .limit(14)
        .all()
    )
    rows_cam = (
        db.query(Alert.camera_id, func.count(Alert.id))
        .group_by(Alert.camera_id)
        .all()
    )
    by_cam = {f"camera_{cid}" if cid is not None else "offline_job": int(c) for cid, c in rows_cam}
    return {
        "latest_evaluation": EvaluationReportOut.model_validate(latest).model_dump()
        if latest
        else None,
        "evaluation_history": [
            {
                "id": e.id,
                "created_at": e.created_at.isoformat(),
                "fpr_feedback_approx": e.report_json.get("fpr_feedback_approx"),
                "alerts_total": e.report_json.get("alerts_total"),
                "by_camera_bucket": e.report_json.get("by_camera_bucket"),
            }
            for e in reversed(hist)
        ],
        "alerts_all_time_by_camera_bucket": by_cam,
    }
