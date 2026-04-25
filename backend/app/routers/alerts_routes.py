from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import tuple_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.model_training import schedule_retrain_after_feedback
from app.models import (
    Alert,
    AlertCorrelation,
    AnalysisJob,
    Feedback,
    FeedbackLabel,
    TrajectoryPoint,
    TrajectorySummary,
    User,
)
from app.schemas import (
    AlertDetail,
    AlertTrajectoryOut,
    FeedbackCreate,
    FeedbackOut,
    FeedbackResult,
    TrajectoryPoint2D,
)
from app.system_config_service import background_recalc_after_feedback, get_or_create_system_config

router = APIRouter()


def _ai_combined_from_ml(ml: dict | None) -> float | None:
    if not ml:
        return None
    xs: list[float] = []
    if "iforest" in ml and "anomaly_01" in ml["iforest"]:
        xs.append(float(ml["iforest"]["anomaly_01"]))
    if "gru_ae" in ml and "anomaly_01" in ml["gru_ae"]:
        xs.append(float(ml["gru_ae"]["anomaly_01"]))
    return max(xs) if xs else None


def _narrative_for_alert(alert: Alert, summary: TrajectorySummary | None) -> str:
    parts: list[str] = []
    parts.append(f"告警类型为「{alert.alert_type}」，级别 {alert.level}。")
    if summary and summary.features_json:
        f = summary.features_json
        parts.append(
            f"轨迹统计：位移约 {f.get('total_displacement_px', '—')} px，"
            f"均速 {f.get('avg_speed_px_per_s', '—')} px/s，"
            f"折返 {f.get('reversal_count', '—')} 次，ROI 停留帧 {f.get('roi_dwell_frames', '—')}。"
        )
    if summary and summary.ml_scores_json:
        ml = summary.ml_scores_json
        pol = ml.get("policy") or {}
        if pol.get("combined_risk_01") is not None:
            parts.append(
                f"规则+模型联合风险分 {pol.get('combined_risk_01')}（{pol.get('narrative_hint', '')}）。"
            )
        if "identity_head" in ml:
            top = ml["identity_head"].get("top_k") or []
            if top:
                parts.append(
                    "身份头 Top-1："
                    + f"{top[0].get('label', '?')}（概率 {top[0].get('prob', '—')}）。"
                )
        ai = _ai_combined_from_ml(ml)
        if ai is not None:
            parts.append(f"轨迹异常分（ML）约 {ai:.2f}，数值越高越偏离当前园区正常模式。")
    elif not summary:
        parts.append("暂无同轨迹摘要；若为 RTSP 流式告警，仅规则引擎参与。")
    return "".join(parts)


def _enrich_alerts(db: Session, alerts: list[Alert]) -> list[AlertDetail]:
    pairs = [(a.job_id, a.track_id) for a in alerts if a.job_id is not None and a.track_id is not None]
    smap: dict[tuple[int, int], TrajectorySummary] = {}
    if pairs:
        sums = (
            db.query(TrajectorySummary)
            .filter(tuple_(TrajectorySummary.job_id, TrajectorySummary.track_id).in_(pairs))
            .all()
        )
        smap = {(s.job_id, s.track_id): s for s in sums}
    out: list[AlertDetail] = []
    for a in alerts:
        base = AlertDetail.model_validate(a)
        latest_feedback = (
            db.query(Feedback)
            .filter(Feedback.alert_id == a.id)
            .order_by(Feedback.updated_at.desc(), Feedback.created_at.desc())
            .first()
        )
        correlations = (
            db.query(AlertCorrelation)
            .filter(AlertCorrelation.primary_alert_id == a.id)
            .order_by(AlertCorrelation.id.asc())
            .all()
        )
        extra = {
            "feedback": FeedbackOut.model_validate(latest_feedback) if latest_feedback else None,
            "correlations": [
                {
                    "id": c.id,
                    "related_alert_id": c.related_alert_id,
                    "camera_id": c.camera_id,
                    "relation_type": c.relation_type,
                    "details": c.details_json,
                }
                for c in correlations
            ],
        }
        s = smap.get((a.job_id, a.track_id)) if a.job_id is not None and a.track_id is not None else None
        if s is not None:
            out.append(
                base.model_copy(
                    update={
                        **extra,
                        "trajectory_features": s.features_json,
                        "ml_scores": s.ml_scores_json,
                        "ai_combined_score": _ai_combined_from_ml(s.ml_scores_json),
                    }
                )
            )
        else:
            out.append(base.model_copy(update=extra))
    return out


@router.get("", response_model=list[AlertDetail])
def list_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    level: str | None = Query(None, description="按告警级别筛选，如 info / warning / critical"),
    camera_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AlertDetail]:
    q = db.query(Alert).order_by(Alert.triggered_at.desc())
    if level:
        q = q.filter(Alert.level == level.strip())
    if camera_id is not None:
        q = q.filter(Alert.camera_id == camera_id)
    rows = q.offset(skip).limit(limit).all()
    return _enrich_alerts(db, rows)


@router.get("/{alert_id}/trajectory", response_model=AlertTrajectoryOut)
def get_alert_trajectory(
    alert_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AlertTrajectoryOut:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    summary = None
    if alert.job_id is not None and alert.track_id is not None:
        summary = (
            db.query(TrajectorySummary)
            .filter(
                TrajectorySummary.job_id == alert.job_id,
                TrajectorySummary.track_id == alert.track_id,
            )
            .first()
        )
    fw, fh = 1280, 720
    points: list[TrajectoryPoint2D] = []
    if alert.job_id is not None and alert.track_id is not None:
        job = db.query(AnalysisJob).filter(AnalysisJob.id == alert.job_id).first()
        if job and job.frame_width and job.frame_height:
            fw, fh = int(job.frame_width), int(job.frame_height)
        pts = (
            db.query(TrajectoryPoint)
            .filter(
                TrajectoryPoint.job_id == alert.job_id,
                TrajectoryPoint.track_id == alert.track_id,
            )
            .order_by(TrajectoryPoint.frame_idx.asc())
            .all()
        )
        points = [TrajectoryPoint2D(frame_idx=p.frame_idx, cx=p.cx, cy=p.cy) for p in pts]
    return AlertTrajectoryOut(
        alert_id=alert.id,
        job_id=alert.job_id,
        track_id=alert.track_id,
        frame_width=fw,
        frame_height=fh,
        points=points,
        narrative=_narrative_for_alert(alert, summary),
        alert_type=alert.alert_type,
    )


@router.get("/{alert_id}", response_model=AlertDetail)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AlertDetail:
    row = db.query(Alert).filter(Alert.id == alert_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return _enrich_alerts(db, [row])[0]


@router.post("/{alert_id}/feedback", response_model=FeedbackResult)
def submit_feedback(
    alert_id: int,
    body: FeedbackCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FeedbackResult:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    existing = (
        db.query(Feedback)
        .filter(Feedback.alert_id == alert_id)
        .first()
    )
    if existing:
        existing.label = body.label
        existing.note = body.note
        from datetime import datetime, timezone

        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        fb = existing
        msg = "updated"
    else:
        fb = Feedback(alert_id=alert_id, user_id=user.id, label=body.label, note=body.note)
        db.add(fb)
        db.commit()
        db.refresh(fb)
        msg = "created"
    bg.add_task(background_recalc_after_feedback)
    if body.label == FeedbackLabel.false_positive:
        cfg = get_or_create_system_config(db)
        if cfg.retrain_on_feedback:
            schedule_retrain_after_feedback(int(cfg.retrain_feedback_delay_sec))
    return FeedbackResult(feedback=FeedbackOut.model_validate(fb), message=msg)
