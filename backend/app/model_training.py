"""异步训练任务：版本化写入 models/versions/<id> 并切换 active 指针。"""

from __future__ import annotations

import threading
import traceback
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.evaluation_service import split_train_holdout_jobs
from app.model_registry import sync_active_version_from_db
from app.models import TrainingRun, TrainingRunStatus
from app.system_config_service import get_or_create_system_config


def _run_training(run_id: int) -> None:
    import sys
    from pathlib import Path

    root = settings.project_root
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    if str(root / "backend") not in sys.path:
        sys.path.insert(0, str(root / "backend"))

    from ml.inference import clear_model_cache
    from ml.train_ops import run_classifier_training, run_gru_ae_training, run_iforest_training

    db = SessionLocal()
    try:
        tr = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
        if tr is None:
            return
        tr.status = TrainingRunStatus.running
        db.commit()

        row = get_or_create_system_config(db)
        train_ids, hold_ids = split_train_holdout_jobs(db, float(row.holdout_job_fraction))
        version_id = datetime.now(timezone.utc).strftime("v%Y%m%dT%H%M%SZ")
        out_dir = settings.project_root / "models" / "versions" / version_id
        out_dir.mkdir(parents=True, exist_ok=True)

        msgs: list[str] = []
        ok1, m1 = run_iforest_training(db, out_dir, restrict_job_ids=train_ids)
        msgs.append(m1)
        ok2, m2 = run_gru_ae_training(db, out_dir, restrict_job_ids=train_ids)
        msgs.append(m2)
        ok3, m3 = run_classifier_training(db, out_dir, restrict_job_ids=train_ids)
        msgs.append(m3)

        if not ok1 or not ok2:
            raise RuntimeError("核心模型训练失败: " + " | ".join(msgs))

        row.active_model_version = version_id
        tr.version_id = version_id
        tr.status = TrainingRunStatus.completed
        tr.message = " | ".join(msgs) + (" | clf skipped" if not ok3 else "")
        tr.finished_at = datetime.now(timezone.utc)
        tr.meta_json = {
            "train_job_ids": sorted(train_ids),
            "holdout_job_ids": sorted(hold_ids),
            "classifier_ok": ok3,
        }
        db.commit()
        sync_active_version_from_db(db)
        clear_model_cache()
    except Exception as e:  # noqa: BLE001
        msg = f"{e}\n{traceback.format_exc()}"
        try:
            tr = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
            if tr:
                tr.status = TrainingRunStatus.failed
                tr.message = msg[:8000]
                tr.finished_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def enqueue_training_run(trigger: str = "manual") -> int:
    db = SessionLocal()
    try:
        tr = TrainingRun(trigger=trigger, status=TrainingRunStatus.pending)
        db.add(tr)
        db.commit()
        db.refresh(tr)
        rid = int(tr.id)
    finally:
        db.close()
    t = threading.Thread(target=_run_training, args=(rid,), daemon=True)
    t.start()
    return rid


def schedule_retrain_after_feedback(delay_sec: int) -> int:
    """延迟后启动训练线程；先落库 TrainingRun 便于查询。"""
    import time

    db = SessionLocal()
    try:
        tr = TrainingRun(trigger="feedback", status=TrainingRunStatus.pending)
        db.add(tr)
        db.commit()
        db.refresh(tr)
        rid = int(tr.id)
    finally:
        db.close()

    def _delayed() -> None:
        time.sleep(max(0, delay_sec))
        _run_training(rid)

    threading.Thread(target=_delayed, daemon=True).start()
    return rid
