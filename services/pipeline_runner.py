"""
单视频分析：轨迹点入库、摘要、提前预警与关键帧（供批处理脚本与 API 后台任务调用）。
"""

from __future__ import annotations

import sys
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

# 保证以脚本或 uvicorn 启动时均可 import app 与 services
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
if str(_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(_ROOT / "backend"))

from sqlalchemy.orm import Session

from app.database import SessionLocal, ensure_sqlite_migrations
from app.model_registry import sync_active_version_from_db
from app.models import Alert, AnalysisJob, JobStatus, TrajectoryPoint, TrajectorySummary
from app.system_config_service import effective_config_for_pipeline
from app.unified_policy import combine_rule_and_ml_risk
from ml.inference import default_seq_len_for_gru, score_trajectory
from ml.sequence import points_to_sequence
from services.alert_engine import AlertEngine
from services.ml_scoring import (
    any_model_loaded,
    combined_anomaly_01,
    load_ml_inference_config,
    should_emit_gru_alert,
    should_emit_iforest_alert,
)
from services.pipeline_config import load_pipeline_config
from services.tracking_pipeline import TrackingPipeline
from services.trajectory_analytics import compute_trajectory_features, denormalize_rect, point_in_rect


def _session() -> Session:
    return SessionLocal()


def _ml_alert_exists(db: Session, job_id: int, track_id: int, alert_type: str) -> bool:
    return (
        db.query(Alert)
        .filter(
            Alert.job_id == job_id,
            Alert.track_id == track_id,
            Alert.alert_type == alert_type,
        )
        .first()
        is not None
    )


def run_pipeline_for_job(
    job_id: int,
    video_path: str | Path,
    *,
    config_path: Path | None = None,
) -> None:
    """执行完整流水线；异常时将 job 标为 failed。"""
    video_path = Path(video_path).resolve()
    frames_dir = _ROOT / "storage" / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    ensure_sqlite_migrations()
    db = _session()
    try:
        job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
        if job is None:
            return
        job.status = JobStatus.running
        job.error_message = None
        db.commit()
        sync_active_version_from_db(db)

        if config_path is not None:
            cfg = load_pipeline_config(config_path, _ROOT)
        else:
            cfg = effective_config_for_pipeline(db)

        print(
            f"[pipeline job={job_id}] debounce M={cfg.consecutive_frames_for_escalation} "
            f"dwell_warn={cfg.dwell_warning_sec:.2f}s dwell_alert={cfg.dwell_alert_sec:.2f}s "
            f"cooldown={cfg.cooldown_sec:.1f}s"
        )

        db.query(TrajectoryPoint).filter(TrajectoryPoint.job_id == job_id).delete(
            synchronize_session=False
        )
        db.query(TrajectorySummary).filter(TrajectorySummary.job_id == job_id).delete(
            synchronize_session=False
        )
        db.query(Alert).filter(Alert.job_id == job_id).delete(synchronize_session=False)
        db.commit()

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"无法打开视频: {video_path}")

        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        if fps <= 1e-3:
            fps = 25.0
        fw = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        fh = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        job.frame_width = fw
        job.frame_height = fh
        db.commit()

        track_pipe = TrackingPipeline(
            weights=cfg.weights,
            conf=cfg.conf,
            embedder_gpu=cfg.embedder_gpu,
        )
        alert_engine = AlertEngine(cfg)

        points_by_track: dict[int, list[tuple[int, float, float, float]]] = defaultdict(list)
        pending_rows: list[TrajectoryPoint] = []
        frame_idx = 0

        def flush() -> None:
            if not pending_rows:
                return
            db.add_all(pending_rows)
            db.commit()
            pending_rows.clear()

        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame_idx += 1
            ts = frame_idx / fps
            tracks = track_pipe.update_frame(frame, frame_idx, ts)

            for tr in tracks:
                points_by_track[tr.track_id].append((tr.frame_idx, tr.cx, tr.cy, ts))
                pending_rows.append(
                    TrajectoryPoint(
                        job_id=job_id,
                        frame_idx=tr.frame_idx,
                        track_id=tr.track_id,
                        cx=tr.cx,
                        cy=tr.cy,
                        w=tr.w,
                        h=tr.h,
                        ts=ts,
                    )
                )
                for ev in alert_engine.process_track(
                    tr.track_id, tr.cx, tr.cy, tr.frame_idx, fps, fw, fh
                ):
                    rel = f"storage/frames/job{job_id}_tid{tr.track_id}_f{tr.frame_idx}.jpg"
                    out_abs = _ROOT.joinpath(*rel.split("/"))
                    out_abs.parent.mkdir(parents=True, exist_ok=True)
                    cv2.imwrite(str(out_abs), frame)
                    db.add(
                        Alert(
                            job_id=job_id,
                            level=ev.level,
                            alert_type=ev.alert_type,
                            triggered_at=datetime.now(timezone.utc),
                            track_id=ev.track_id,
                            camera_id=None,
                            keyframe_path=rel.replace("\\", "/"),
                            is_confirmed=ev.is_confirmed,
                        )
                    )
                    db.commit()

            if len(pending_rows) >= cfg.batch_insert_frames:
                flush()

        cap.release()
        flush()

        def roi_pred(cx: float, cy: float) -> bool:
            if cfg.roi_mode == "polygon" and cfg.polygon_norm:
                pts = np.array(
                    [[float(x) * fw, float(y) * fh] for x, y in cfg.polygon_norm],
                    dtype=np.float32,
                )
                return cv2.pointPolygonTest(pts, (cx, cy), False) >= 0
            x1, y1, x2, y2 = denormalize_rect(cfg.rect_norm, fw, fh)
            return point_in_rect(cx, cy, x1, y1, x2, y2)

        for tid, pts in points_by_track.items():
            feats = compute_trajectory_features(pts, fps, roi_predicate=roi_pred)
            db.add(
                TrajectorySummary(
                    job_id=job_id,
                    track_id=tid,
                    features_json=feats,
                )
            )
        db.commit()

        ml_cfg = load_ml_inference_config(db)
        if ml_cfg.get("enabled", True) and any_model_loaded():
            seq_len = default_seq_len_for_gru()
            summaries_rows = (
                db.query(TrajectorySummary).filter(TrajectorySummary.job_id == job_id).all()
            )
            emit_sep = ml_cfg.get("emit_separate_alerts", True)
            for s in summaries_rows:
                pts = points_by_track.get(s.track_id, [])
                seq = points_to_sequence(pts, fw, fh, seq_len=seq_len)
                ml_blob = score_trajectory(s.features_json, seq)
                tr_alerts = (
                    db.query(Alert)
                    .filter(Alert.job_id == job_id, Alert.track_id == s.track_id)
                    .all()
                )
                rule_lv = None
                if tr_alerts:
                    prio = {"alert": 3, "warning": 2, "info": 1, "low": 0}

                    def _pk(a: Alert) -> int:
                        return prio.get((a.level or "").lower(), 0)

                    rule_lv = max(tr_alerts, key=_pk).level
                comb, hint = combine_rule_and_ml_risk(
                    rule_level=rule_lv,
                    ml_anomaly_max=combined_anomaly_01(ml_blob),
                )
                ml_blob["policy"] = {"combined_risk_01": comb, "narrative_hint": hint}
                s.ml_scores_json = ml_blob
                if not emit_sep:
                    continue
                if should_emit_iforest_alert(ml_blob, ml_cfg) and not _ml_alert_exists(
                    db, job_id, s.track_id, "trajectory_ml_iforest"
                ):
                    db.add(
                        Alert(
                            job_id=job_id,
                            level="warning",
                            alert_type="trajectory_ml_iforest",
                            triggered_at=datetime.now(timezone.utc),
                            track_id=s.track_id,
                            camera_id=None,
                            keyframe_path=None,
                            is_confirmed=False,
                        )
                    )
                if should_emit_gru_alert(ml_blob, ml_cfg) and not _ml_alert_exists(
                    db, job_id, s.track_id, "trajectory_ml_gru"
                ):
                    db.add(
                        Alert(
                            job_id=job_id,
                            level="warning",
                            alert_type="trajectory_ml_gru",
                            triggered_at=datetime.now(timezone.utc),
                            track_id=s.track_id,
                            camera_id=None,
                            keyframe_path=None,
                            is_confirmed=False,
                        )
                    )
            db.commit()

        job.status = JobStatus.completed
        job.error_message = None
        db.commit()
    except Exception as e:  # noqa: BLE001
        err = f"{e}\n{traceback.format_exc()}"
        try:
            j = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
            if j:
                j.status = JobStatus.failed
                j.error_message = err[:8000]
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()


def run_pipeline_for_job_safe(job_id: int, video_path: str | Path) -> None:
    """API 后台任务入口：吞掉异常以免 Starlette 打印未处理错误。"""
    try:
        run_pipeline_for_job(job_id, video_path)
    except Exception as e:  # noqa: BLE001
        print(f"[pipeline] job {job_id} failed: {e}")
