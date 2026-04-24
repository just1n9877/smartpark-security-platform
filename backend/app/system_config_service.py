"""SystemConfig 单行、YAML 基准合并、反馈滚动误报率与自动收紧 M（确认帧数）。"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Alert, Camera, Feedback, FeedbackLabel, SystemConfig
from services.pipeline_config import PipelineConfig, load_pipeline_config


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def yaml_baseline_config() -> PipelineConfig:
    return load_pipeline_config(None, settings.project_root)


def get_or_create_system_config(db: Session) -> SystemConfig:
    row = db.query(SystemConfig).filter(SystemConfig.id == 1).first()
    if row is not None:
        return row
    base = yaml_baseline_config()
    row = SystemConfig(
        id=1,
        consecutive_frames_for_escalation=base.consecutive_frames_for_escalation,
        dwell_warning_sec=base.dwell_warning_sec,
        dwell_alert_sec=base.dwell_alert_sec,
        cooldown_sec=base.cooldown_sec,
        reversal_alert_k=base.reversal_alert_k,
        feedback_window_n=20,
        high_fp_threshold=0.4,
        max_consecutive_frames=12,
        ml_enabled=True,
        ml_iforest_min_anomaly_01=0.55,
        ml_gru_min_anomaly_01=0.5,
        ml_emit_separate_alerts=True,
        active_model_version=None,
        retrain_on_feedback=False,
        retrain_feedback_delay_sec=10,
        retrain_interval_hours=0,
        last_scheduled_train_at=None,
        holdout_job_fraction=0.2,
        rtsp_max_workers=4,
        stream_alert_merge_sec=45.0,
        updated_at=_utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def merge_pipeline_config(base: PipelineConfig, row: SystemConfig) -> PipelineConfig:
    return replace(
        base,
        dwell_warning_sec=row.dwell_warning_sec,
        dwell_alert_sec=row.dwell_alert_sec,
        cooldown_sec=row.cooldown_sec,
        consecutive_frames_for_escalation=row.consecutive_frames_for_escalation,
        reversal_alert_k=row.reversal_alert_k,
    )


def effective_config_for_pipeline(db: Session) -> PipelineConfig:
    base = yaml_baseline_config()
    row = get_or_create_system_config(db)
    return merge_pipeline_config(base, row)


def _rate_for_feedbacks(fbs: list[Feedback]) -> tuple[int, int, float | None]:
    n = len(fbs)
    if n == 0:
        return 0, 0, None
    fp = sum(1 for f in fbs if f.label == FeedbackLabel.false_positive)
    return n, fp, round(fp / n, 4)


def feedback_rollup(db: Session, window_n: int) -> dict:
    """全局与按摄像头的最近 window_n 条反馈误报率。"""
    global_fbs = (
        db.query(Feedback).order_by(Feedback.created_at.desc()).limit(window_n).all()
    )
    gn, gfp, gr = _rate_for_feedbacks(global_fbs)

    cams = db.query(Camera.id, Camera.name).all()
    by_camera: list[dict] = []
    for cid, cname in cams:
        subq = (
            db.query(Feedback)
            .join(Alert, Feedback.alert_id == Alert.id)
            .filter(Alert.camera_id == cid)
            .order_by(Feedback.created_at.desc())
            .limit(window_n)
            .all()
        )
        tn, tfp, tr = _rate_for_feedbacks(subq)
        by_camera.append(
            {
                "camera_id": cid,
                "camera_name": cname,
                "sample_size": tn,
                "false_positives": tfp,
                "false_positive_rate": tr,
            }
        )

    unassigned = (
        db.query(Feedback)
        .join(Alert, Feedback.alert_id == Alert.id)
        .filter(Alert.camera_id.is_(None))
        .order_by(Feedback.created_at.desc())
        .limit(window_n)
        .all()
    )
    un_n, un_fp, un_r = _rate_for_feedbacks(unassigned)
    by_camera.append(
        {
            "camera_id": None,
            "camera_name": "(未绑定摄像头)",
            "sample_size": un_n,
            "false_positives": un_fp,
            "false_positive_rate": un_r,
        }
    )

    return {
        "window_n": window_n,
        "global": {"sample_size": gn, "false_positives": gfp, "false_positive_rate": gr},
        "by_camera": by_camera,
    }


def background_recalc_after_feedback() -> None:
    """供 FastAPI BackgroundTasks 调用（独立 Session）。"""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        recalc_after_feedback(db)
    finally:
        db.close()


def recalc_after_feedback(db: Session) -> None:
    """反馈写入后调用：若最近 N 条全局误报率偏高，则提高确认帧数 M（上限 max_consecutive_frames）。"""
    row = get_or_create_system_config(db)
    n = row.feedback_window_n
    threshold = row.high_fp_threshold
    recent = (
        db.query(Feedback).order_by(Feedback.created_at.desc()).limit(n).all()
    )
    if len(recent) < 3:
        return
    _, fp_count, rate = _rate_for_feedbacks(recent)
    if rate is None:
        return
    if rate < threshold:
        return
    old_m = row.consecutive_frames_for_escalation
    new_m = min(old_m + 1, row.max_consecutive_frames)
    if new_m == old_m:
        print(
            f"[system_config] auto-tune skipped: fp_rate={rate} >= {threshold} "
            f"but M already at cap {row.max_consecutive_frames}"
        )
        return
    row.consecutive_frames_for_escalation = new_m
    # 统一策略：同步略抬 ML 告警阈值，减少误报（与规则 M 同向）
    ifi = float(getattr(row, "ml_iforest_min_anomaly_01", 0.55))
    gru = float(getattr(row, "ml_gru_min_anomaly_01", 0.5))
    row.ml_iforest_min_anomaly_01 = min(0.95, round(ifi + 0.03, 3))
    row.ml_gru_min_anomaly_01 = min(0.95, round(gru + 0.03, 3))
    row.updated_at = _utcnow()
    db.commit()
    print(
        f"[system_config] auto-tune: rolling_fp_rate={rate} (fp={fp_count}/{len(recent)}) "
        f"=> consecutive_frames {old_m} -> {new_m}, "
        f"ml_if_th={row.ml_iforest_min_anomaly_01}, ml_gru_th={row.ml_gru_min_anomaly_01}"
    )


def reset_system_config_from_yaml(db: Session) -> SystemConfig:
    base = yaml_baseline_config()
    row = get_or_create_system_config(db)
    row.consecutive_frames_for_escalation = base.consecutive_frames_for_escalation
    row.dwell_warning_sec = base.dwell_warning_sec
    row.dwell_alert_sec = base.dwell_alert_sec
    row.cooldown_sec = base.cooldown_sec
    row.reversal_alert_k = base.reversal_alert_k
    row.ml_iforest_min_anomaly_01 = 0.55
    row.ml_gru_min_anomaly_01 = 0.5
    row.ml_enabled = True
    row.ml_emit_separate_alerts = True
    row.updated_at = _utcnow()
    db.commit()
    db.refresh(row)
    return row
