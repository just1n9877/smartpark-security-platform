from __future__ import annotations

import sys
from collections.abc import Iterable
from pathlib import Path

# 训练脚本独立运行时注入 backend 到 path
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(_ROOT / "backend"))

from sqlalchemy.orm import Session

from app.models import (  # noqa: E402
    Alert,
    AnalysisJob,
    Feedback,
    FeedbackLabel,
    JobStatus,
    TrajectoryPoint,
    TrajectorySummary,
)

# 弱监督：安保标注为「非可疑」的轨迹，优先作为 GRU 自编码器「正常」训练集
BENIGN_LABELS: tuple[FeedbackLabel, ...] = (
    FeedbackLabel.false_positive,
    FeedbackLabel.delivery,
    FeedbackLabel.visitor,
    FeedbackLabel.work,
    FeedbackLabel.other,
)


def benign_track_pairs(db: Session) -> set[tuple[int, int]]:
    rows = (
        db.query(Alert.job_id, Alert.track_id)
        .join(Feedback, Feedback.alert_id == Alert.id)
        .filter(Feedback.label.in_(BENIGN_LABELS))
        .filter(Alert.job_id.isnot(None))
        .filter(Alert.track_id.isnot(None))
        .distinct()
        .all()
    )
    return {(int(r.job_id), int(r.track_id)) for r in rows}


def suspicious_track_pairs(db: Session) -> set[tuple[int, int]]:
    rows = (
        db.query(Alert.job_id, Alert.track_id)
        .join(Feedback, Feedback.alert_id == Alert.id)
        .filter(Feedback.label == FeedbackLabel.suspicious)
        .filter(Alert.job_id.isnot(None))
        .filter(Alert.track_id.isnot(None))
        .distinct()
        .all()
    )
    return {(int(r.job_id), int(r.track_id)) for r in rows}


def iter_summaries_completed_jobs(
    db: Session,
    *,
    restrict_pairs: Iterable[tuple[int, int]] | None = None,
    restrict_job_ids: set[int] | None = None,
) -> list[TrajectorySummary]:
    q = (
        db.query(TrajectorySummary)
        .join(AnalysisJob, TrajectorySummary.job_id == AnalysisJob.id)
        .filter(AnalysisJob.status == JobStatus.completed)
    )
    rows = q.all()
    if restrict_job_ids is not None:
        rows = [r for r in rows if r.job_id in restrict_job_ids]
    if restrict_pairs is not None:
        allow = set(restrict_pairs)
        rows = [r for r in rows if (r.job_id, r.track_id) in allow]
    return rows


def labeled_track_feedback_map(
    db: Session,
    *,
    restrict_job_ids: set[int] | None = None,
) -> dict[tuple[int, int], str]:
    """(job_id, track_id) → 最新一条反馈类别 value（多类头训练）。"""
    rows = (
        db.query(Feedback, Alert)
        .join(Alert, Feedback.alert_id == Alert.id)
        .filter(Alert.job_id.isnot(None))
        .filter(Alert.track_id.isnot(None))
        .order_by(Feedback.created_at.asc())
        .all()
    )
    out: dict[tuple[int, int], str] = {}
    for fb, al in rows:
        jid, tid = int(al.job_id), int(al.track_id)
        if restrict_job_ids is not None and jid not in restrict_job_ids:
            continue
        out[(jid, tid)] = fb.label.value
    return out


def load_points_for_track(db: Session, job_id: int, track_id: int) -> list[tuple[int, float, float, float]]:
    pts = (
        db.query(TrajectoryPoint)
        .filter(TrajectoryPoint.job_id == job_id, TrajectoryPoint.track_id == track_id)
        .order_by(TrajectoryPoint.frame_idx.asc())
        .all()
    )
    return [(p.frame_idx, p.cx, p.cy, p.ts) for p in pts]
