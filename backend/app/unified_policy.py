"""统一策略：DB 覆盖 config/ml_inference.yaml；规则调参与 ML 阈值同向联动见 system_config_service。"""

from __future__ import annotations

from typing import Any

import yaml
from sqlalchemy.orm import Session

from app.config import settings
from app.system_config_service import get_or_create_system_config


def _yaml_ml_defaults() -> dict[str, Any]:
    p = settings.project_root / "config" / "ml_inference.yaml"
    if not p.exists():
        return {
            "enabled": True,
            "emit_separate_alerts": True,
            "iforest": {"alert_if_outlier": True, "min_anomaly_01_for_alert": 0.55},
            "gru_ae": {"alert_if_above_p95": True, "min_anomaly_01_for_alert": 0.5},
        }
    with p.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def effective_ml_policy(db: Session) -> dict[str, Any]:
    """与 services/ml_scoring 使用的结构一致；阈值以 system_configs 为准。"""
    row = get_or_create_system_config(db)
    base = _yaml_ml_defaults()
    iforest = dict(base.get("iforest") or {})
    gru = dict(base.get("gru_ae") or {})
    iforest["min_anomaly_01_for_alert"] = float(row.ml_iforest_min_anomaly_01)
    gru["min_anomaly_01_for_alert"] = float(row.ml_gru_min_anomaly_01)
    return {
        "enabled": bool(row.ml_enabled),
        "emit_separate_alerts": bool(row.ml_emit_separate_alerts),
        "iforest": iforest,
        "gru_ae": gru,
    }


def combine_rule_and_ml_risk(
    *,
    rule_level: str | None,
    ml_anomaly_max: float | None,
) -> tuple[float, str]:
    """
    文档化联合函数：最终风险度 = max(规则等级映射, ML 异常分)。
    返回 (0-1 分数, 简短说明)。
    """
    rule_map = {"alert": 0.85, "warning": 0.55, "info": 0.25, "low": 0.2}
    r = rule_map.get((rule_level or "").lower(), 0.35)
    m = float(ml_anomaly_max) if ml_anomaly_max is not None else 0.0
    score = max(r, m)
    if m > r:
        hint = "主要由轨迹模型偏离常态驱动"
    elif r > m:
        hint = "主要由规则引擎（停留/折返/ROI）驱动"
    else:
        hint = "规则与模型风险相当"
    return round(min(1.0, score), 4), hint
