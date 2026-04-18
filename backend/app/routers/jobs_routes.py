import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Alert, AnalysisJob, JobStatus, TrajectoryPoint, TrajectorySummary, User
from app.schemas import JobDetail, JobOut, RunLocalPathBody

router = APIRouter()


@router.get("", response_model=list[JobOut])
def list_jobs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AnalysisJob]:
    return (
        db.query(AnalysisJob)
        .order_by(AnalysisJob.created_at.desc())
        .limit(limit)
        .all()
    )


def _enqueue_pipeline(job_id: int, video_path: str) -> None:
    import sys

    root = settings.project_root
    for p in (str(root), str(root / "backend")):
        if p not in sys.path:
            sys.path.insert(0, p)
    from services.pipeline_runner import run_pipeline_for_job_safe

    run_pipeline_for_job_safe(job_id, video_path)


@router.post("", response_model=dict)
async def create_job(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """登记分析任务：JSON `{"local_path": "..."}` 或 multipart 字段 `file` 上传视频。"""
    _ = user
    content_type = request.headers.get("content-type", "").lower()

    if "application/json" in content_type:
        data = await request.json()
        if not isinstance(data, dict):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid JSON")
        local_path = (data.get("local_path") or "").strip()
        if not local_path:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="local_path is required for JSON body",
            )
        job = AnalysisJob(video_path=local_path, status=JobStatus.pending)
        db.add(job)
        db.commit()
        db.refresh(job)
        return {"id": job.id, "video_path": job.video_path, "status": job.status.value}

    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        if file is None or not hasattr(file, "read"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="multipart field 'file' is required",
            )
        upload = file
        assert isinstance(upload, UploadFile)
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(upload.filename or "video").suffix or ".mp4"
        dest = settings.uploads_dir / f"{uuid.uuid4().hex}{suffix}"
        with dest.open("wb") as out:
            shutil.copyfileobj(upload.file, out)
        job = AnalysisJob(video_path=str(dest.resolve()), status=JobStatus.pending)
        db.add(job)
        db.commit()
        db.refresh(job)
        return {"id": job.id, "video_path": job.video_path, "status": job.status.value}

    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Use application/json with local_path or multipart/form-data with file",
    )


@router.post("/run_local_path", response_model=dict)
def run_local_path(
    body: RunLocalPathBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """异步执行轨迹/告警流水线（不阻塞 HTTP；轮询 GET /jobs/{id}）。"""
    _ = user
    p = Path(body.path).expanduser()
    if not p.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    job = AnalysisJob(video_path=str(p.resolve()), status=JobStatus.pending)
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(_enqueue_pipeline, job.id, str(p.resolve()))
    return {"job_id": job.id, "status": "queued", "video_path": job.video_path}


@router.get("/{job_id}", response_model=JobDetail)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> JobDetail:
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    ntp = db.query(TrajectoryPoint).filter(TrajectoryPoint.job_id == job_id).count()
    nts = db.query(TrajectorySummary).filter(TrajectorySummary.job_id == job_id).count()
    na = db.query(Alert).filter(Alert.job_id == job_id).count()
    return JobDetail(
        id=job.id,
        video_path=job.video_path,
        status=job.status,
        error_message=job.error_message,
        created_at=job.created_at,
        trajectory_points_count=ntp,
        trajectory_summaries_count=nts,
        alerts_count=na,
    )
