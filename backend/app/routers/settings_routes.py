from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import User
from app.schemas import (
    FeedbackRollupOut,
    PipelineSettingsBlock,
    SettingsOut,
    SettingsPatch,
    TuningParamsOut,
    UnifiedMlPolicyOut,
)
from app.system_config_service import (
    feedback_rollup,
    get_or_create_system_config,
    merge_pipeline_config,
    reset_system_config_from_yaml,
    yaml_baseline_config,
)

router = APIRouter()


def _build_settings_out(db: Session) -> SettingsOut:
    base = yaml_baseline_config()
    row = get_or_create_system_config(db)
    eff = merge_pipeline_config(base, row)
    rollup = feedback_rollup(db, row.feedback_window_n)
    return SettingsOut(
        effective=PipelineSettingsBlock(
            consecutive_frames_for_escalation=eff.consecutive_frames_for_escalation,
            dwell_warning_sec=eff.dwell_warning_sec,
            dwell_alert_sec=eff.dwell_alert_sec,
            cooldown_sec=eff.cooldown_sec,
            reversal_alert_k=eff.reversal_alert_k,
        ),
        yaml_baseline=PipelineSettingsBlock(
            consecutive_frames_for_escalation=base.consecutive_frames_for_escalation,
            dwell_warning_sec=base.dwell_warning_sec,
            dwell_alert_sec=base.dwell_alert_sec,
            cooldown_sec=base.cooldown_sec,
            reversal_alert_k=base.reversal_alert_k,
        ),
        tuning=TuningParamsOut(
            feedback_window_n=row.feedback_window_n,
            high_fp_threshold=row.high_fp_threshold,
            max_consecutive_frames=row.max_consecutive_frames,
            updated_at=row.updated_at,
        ),
        feedback_rollup=FeedbackRollupOut.model_validate(rollup),
        unified_ml=UnifiedMlPolicyOut(
            ml_enabled=bool(getattr(row, "ml_enabled", True)),
            ml_iforest_min_anomaly_01=float(getattr(row, "ml_iforest_min_anomaly_01", 0.55)),
            ml_gru_min_anomaly_01=float(getattr(row, "ml_gru_min_anomaly_01", 0.5)),
            ml_emit_separate_alerts=bool(getattr(row, "ml_emit_separate_alerts", True)),
            active_model_version=getattr(row, "active_model_version", None),
            retrain_on_feedback=bool(getattr(row, "retrain_on_feedback", False)),
            retrain_feedback_delay_sec=int(getattr(row, "retrain_feedback_delay_sec", 10)),
            retrain_interval_hours=int(getattr(row, "retrain_interval_hours", 0)),
            holdout_job_fraction=float(getattr(row, "holdout_job_fraction", 0.2)),
            rtsp_max_workers=int(getattr(row, "rtsp_max_workers", 4)),
            stream_alert_merge_sec=float(getattr(row, "stream_alert_merge_sec", 45.0)),
        ),
    )


@router.get("", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SettingsOut:
    return _build_settings_out(db)


@router.patch("", response_model=SettingsOut)
def patch_settings(
    body: SettingsPatch,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> SettingsOut:
    if body.reset_to_yaml_defaults:
        reset_system_config_from_yaml(db)
    else:
        row = get_or_create_system_config(db)
        if body.consecutive_frames_for_escalation is not None:
            row.consecutive_frames_for_escalation = body.consecutive_frames_for_escalation
        if body.dwell_warning_sec is not None:
            row.dwell_warning_sec = body.dwell_warning_sec
        if body.dwell_alert_sec is not None:
            row.dwell_alert_sec = body.dwell_alert_sec
        if body.cooldown_sec is not None:
            row.cooldown_sec = body.cooldown_sec
        if body.reversal_alert_k is not None:
            row.reversal_alert_k = body.reversal_alert_k
        if body.feedback_window_n is not None:
            row.feedback_window_n = body.feedback_window_n
        if body.high_fp_threshold is not None:
            row.high_fp_threshold = body.high_fp_threshold
        if body.max_consecutive_frames is not None:
            row.max_consecutive_frames = body.max_consecutive_frames
        if body.ml_enabled is not None:
            row.ml_enabled = body.ml_enabled
        if body.ml_iforest_min_anomaly_01 is not None:
            row.ml_iforest_min_anomaly_01 = body.ml_iforest_min_anomaly_01
        if body.ml_gru_min_anomaly_01 is not None:
            row.ml_gru_min_anomaly_01 = body.ml_gru_min_anomaly_01
        if body.ml_emit_separate_alerts is not None:
            row.ml_emit_separate_alerts = body.ml_emit_separate_alerts
        if body.retrain_on_feedback is not None:
            row.retrain_on_feedback = body.retrain_on_feedback
        if body.retrain_feedback_delay_sec is not None:
            row.retrain_feedback_delay_sec = body.retrain_feedback_delay_sec
        if body.retrain_interval_hours is not None:
            row.retrain_interval_hours = body.retrain_interval_hours
        if body.holdout_job_fraction is not None:
            row.holdout_job_fraction = body.holdout_job_fraction
        if body.rtsp_max_workers is not None:
            row.rtsp_max_workers = body.rtsp_max_workers
        if body.stream_alert_merge_sec is not None:
            row.stream_alert_merge_sec = body.stream_alert_merge_sec
        row.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)

    return _build_settings_out(db)
