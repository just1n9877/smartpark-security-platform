from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import Camera, SceneRule
from services.pipeline_config import PipelineConfig


@dataclass(frozen=True)
class SceneRuleConfig:
    id: int | None
    camera_id: int | None
    name: str
    rule_type: str
    geometry: dict[str, Any]
    risk_level: int = 2
    is_enabled: bool = True
    schedule_json: dict[str, Any] | None = None
    allowed_direction: str | None = None
    dwell_threshold_sec: float = 8.0
    config_json: dict[str, Any] | None = field(default_factory=dict)
    camera_risk_level: int = 2


def row_to_rule(row: SceneRule, camera: Camera | None = None) -> SceneRuleConfig:
    return SceneRuleConfig(
        id=row.id,
        camera_id=row.camera_id,
        name=row.name,
        rule_type=row.rule_type,
        geometry=row.geometry or {},
        risk_level=int(row.risk_level or 2),
        is_enabled=bool(row.is_enabled),
        schedule_json=row.schedule_json,
        allowed_direction=row.allowed_direction,
        dwell_threshold_sec=float(row.dwell_threshold_sec or 8.0),
        config_json=row.config_json or {},
        camera_risk_level=int(camera.risk_level if camera else 2),
    )


def fallback_rule_from_pipeline(cfg: PipelineConfig, camera_id: int | None = None) -> SceneRuleConfig:
    geometry: dict[str, Any]
    if cfg.roi_mode == "polygon" and cfg.polygon_norm:
        geometry = {"points": cfg.polygon_norm}
    else:
        x1, y1, x2, y2 = cfg.rect_norm
        geometry = {"points": [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]}
    return SceneRuleConfig(
        id=None,
        camera_id=camera_id,
        name="默认安全区域",
        rule_type="area",
        geometry=geometry,
        risk_level=3,
        dwell_threshold_sec=float(cfg.dwell_alert_sec),
        config_json={"source": "pipeline_fallback", "behavior": cfg.behavior},
    )


def load_scene_rules(db: Session, camera_id: int | None, cfg: PipelineConfig) -> list[SceneRuleConfig]:
    q = db.query(SceneRule).filter(SceneRule.is_enabled.is_(True))
    if camera_id is None:
        q = q.filter(SceneRule.camera_id.is_(None))
    else:
        q = q.filter(SceneRule.camera_id == camera_id)
    rows = q.order_by(SceneRule.id.asc()).all()
    if not rows:
        return [fallback_rule_from_pipeline(cfg, camera_id)]
    cam = db.query(Camera).filter(Camera.id == camera_id).first() if camera_id is not None else None
    return [row_to_rule(r, cam) for r in rows]


def is_non_authorized_time(rule: SceneRuleConfig, when: datetime) -> bool:
    schedule = rule.schedule_json or {}
    windows = schedule.get("authorized_windows")
    if not windows:
        hour = when.hour
        return hour < 6 or hour >= 22
    current = when.strftime("%H:%M")
    for item in windows:
        start = str(item.get("start", "00:00"))
        end = str(item.get("end", "23:59"))
        if start <= current <= end:
            return False
    return True
