"""Holdout 评测：持久化 JSON 报告。"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Alert, AnalysisJob, EvaluationReport, Feedback, FeedbackLabel, JobStatus


def split_train_holdout_jobs(db: Session, fraction: float) -> tuple[set[int], set[int]]:
    rows = (
        db.query(AnalysisJob.id)
        .filter(AnalysisJob.status == JobStatus.completed)
        .order_by(AnalysisJob.created_at.asc())
        .all()
    )
    ids = [r[0] for r in rows]
    if len(ids) < 2:
        return set(ids), set()
    k = max(1, int(len(ids) * max(0.05, min(0.5, fraction))))
    holdout = set(ids[-k:])
    train = set(ids[:-k])
    return train, holdout


def run_holdout_evaluation(db: Session, holdout_job_ids: set[int]) -> dict[str, Any]:
    """基于 holdout job 上告警与反馈估计 FPR、告警密度等。"""
    if not holdout_job_ids:
        return {"error": "empty_holdout", "fpr_feedback_approx": None}

    alert_ids = [r[0] for r in db.query(Alert.id).filter(Alert.job_id.in_(holdout_job_ids)).all()]
    if not alert_ids:
        return {
            "holdout_job_ids": sorted(holdout_job_ids),
            "alerts_total": 0,
            "fpr_feedback_approx": None,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

    fb_rows = db.query(Feedback).filter(Feedback.alert_id.in_(alert_ids)).all()
    n_fb = len(fb_rows)
    n_fp = sum(1 for f in fb_rows if f.label == FeedbackLabel.false_positive)
    fpr = round(n_fp / n_fb, 4) if n_fb else None

    alert_count = db.query(func.count(Alert.id)).filter(Alert.job_id.in_(holdout_job_ids)).scalar()
    by_type: dict[str, int] = defaultdict(int)
    for row in (
        db.query(Alert.alert_type, func.count(Alert.id))
        .filter(Alert.job_id.in_(holdout_job_ids))
        .group_by(Alert.alert_type)
        .all()
    ):
        by_type[str(row[0])] = int(row[1])

    by_cam: dict[str, int] = defaultdict(int)
    for cid, cnt in (
        db.query(Alert.camera_id, func.count(Alert.id))
        .filter(Alert.job_id.in_(holdout_job_ids))
        .group_by(Alert.camera_id)
        .all()
    ):
        key = f"camera_{cid}" if cid is not None else "offline_job"
        by_cam[key] = int(cnt)

    return {
        "holdout_job_ids": sorted(holdout_job_ids),
        "alerts_total": int(alert_count or 0),
        "alerts_per_job": round(float(alert_count or 0) / max(len(holdout_job_ids), 1), 4),
        "feedback_count": n_fb,
        "false_positive_feedback_count": n_fp,
        "fpr_feedback_approx": fpr,
        "by_alert_type": dict(by_type),
        "by_camera_bucket": dict(by_cam),
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }


def persist_evaluation(db: Session, report: dict[str, Any], note: str | None = None) -> EvaluationReport:
    row = EvaluationReport(report_json=report, note=note)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
