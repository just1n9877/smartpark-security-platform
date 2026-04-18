from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Alert, Feedback, User
from app.schemas import AlertDetail, AlertOut, FeedbackCreate, FeedbackOut, FeedbackResult
from app.system_config_service import background_recalc_after_feedback

router = APIRouter()


@router.get("", response_model=list[AlertOut])
def list_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    level: str | None = Query(None, description="按告警级别筛选，如 info / warning / critical"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Alert]:
    q = db.query(Alert).order_by(Alert.triggered_at.desc())
    if level:
        q = q.filter(Alert.level == level.strip())
    return q.offset(skip).limit(limit).all()


@router.get("/{alert_id}", response_model=AlertDetail)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Alert:
    row = db.query(Alert).filter(Alert.id == alert_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return row


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
        .filter(Feedback.alert_id == alert_id, Feedback.user_id == user.id)
        .first()
    )
    if existing:
        existing.label = body.label
        existing.note = body.note
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
    return FeedbackResult(feedback=FeedbackOut.model_validate(fb), message=msg)
