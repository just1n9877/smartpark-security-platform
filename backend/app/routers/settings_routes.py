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
        row.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)

    return _build_settings_out(db)
