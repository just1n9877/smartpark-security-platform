from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import require_admin
from app.evaluation_service import persist_evaluation, run_holdout_evaluation, split_train_holdout_jobs
from app.model_registry import activate_model_version
from app.model_training import enqueue_training_run
from app.models import EvaluationReport, TrainingRun, User
from app.schemas import ActivateModelBody, EvaluationReportOut, TrainingRunOut
from ml.inference import clear_model_cache
from services.streaming_service import active_stream_camera_ids, start_camera_stream, stop_camera_stream

router = APIRouter()


def _run_out(r: TrainingRun) -> TrainingRunOut:
    return TrainingRunOut(
        id=r.id,
        status=r.status.value if hasattr(r.status, "value") else str(r.status),
        trigger=r.trigger,
        version_id=r.version_id,
        message=r.message,
        meta_json=r.meta_json,
        created_at=r.created_at,
        finished_at=r.finished_at,
    )


@router.get("/training/runs", response_model=list[TrainingRunOut])
def list_training_runs(
    limit: int = 30,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[TrainingRunOut]:
    rows = db.query(TrainingRun).order_by(TrainingRun.created_at.desc()).limit(min(limit, 200)).all()
    return [_run_out(r) for r in rows]


@router.post("/training/enqueue", response_model=TrainingRunOut)
def enqueue_training(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> TrainingRunOut:
    rid = enqueue_training_run("manual")
    row = db.query(TrainingRun).filter(TrainingRun.id == rid).first()
    if row is None:
        raise HTTPException(status_code=500, detail="training run not found")
    return _run_out(row)


@router.get("/models/versions")
def list_model_versions(
    _: User = Depends(require_admin),
) -> dict[str, list[str]]:
    root = settings.project_root / "models" / "versions"
    if not root.is_dir():
        return {"versions": []}
    vs = sorted([p.name for p in root.iterdir() if p.is_dir()])
    return {"versions": vs}


@router.post("/models/activate")
def activate_model(
    body: ActivateModelBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, str]:
    try:
        activate_model_version(db, body.version_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    clear_model_cache()
    return {"active": body.version_id}


@router.post("/evaluation/run", response_model=EvaluationReportOut)
def run_evaluation(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> EvaluationReport:
    from app.system_config_service import get_or_create_system_config

    row = get_or_create_system_config(db)
    _, hold = split_train_holdout_jobs(db, float(row.holdout_job_fraction))
    report = run_holdout_evaluation(db, hold)
    note = f"holdout_fraction={row.holdout_job_fraction}"
    return persist_evaluation(db, report, note=note)


@router.get("/evaluation/latest", response_model=EvaluationReportOut | None)
def latest_evaluation(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> EvaluationReport | None:
    return db.query(EvaluationReport).order_by(EvaluationReport.created_at.desc()).first()


@router.post("/streams/{camera_id}/start")
def start_stream(
    camera_id: int,
    _: User = Depends(require_admin),
) -> dict[str, object]:
    ok = start_camera_stream(camera_id)
    return {"started": ok, "active": active_stream_camera_ids()}


@router.post("/streams/{camera_id}/stop")
def stop_stream(
    camera_id: int,
    _: User = Depends(require_admin),
) -> dict[str, object]:
    stop_camera_stream(camera_id)
    return {"stopped": True, "active": active_stream_camera_ids()}


@router.get("/streams/active")
def streams_active(
    _: User = Depends(require_admin),
) -> dict[str, list[int]]:
    return {"camera_ids": active_stream_camera_ids()}
