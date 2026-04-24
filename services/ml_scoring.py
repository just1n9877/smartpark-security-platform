"""流水线内：统一策略（DB + YAML）驱动 ML 告警阈值。"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from sqlalchemy.orm import Session

from ml.inference import models_available, score_trajectory

_ROOT = Path(__file__).resolve().parents[1]


def _yaml_only_config() -> dict[str, Any]:
    p = _ROOT / "config" / "ml_inference.yaml"
    if not p.exists():
        return {"enabled": False}
    with p.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {"enabled": False}


def load_ml_inference_config(db: Session | None) -> dict[str, Any]:
    if db is not None:
        from app.unified_policy import effective_ml_policy

        return effective_ml_policy(db)
    return _yaml_only_config()


def should_emit_iforest_alert(ml: dict[str, Any], cfg: dict[str, Any]) -> bool:
    if not cfg.get("enabled", True):
        return False
    sub = cfg.get("iforest") or {}
    block = ml.get("iforest")
    if not block:
        return False
    if not sub.get("alert_if_outlier", True):
        return False
    if not block.get("is_outlier"):
        return False
    th = float(sub.get("min_anomaly_01_for_alert", 0.5))
    return float(block.get("anomaly_01", 0)) >= th


def should_emit_gru_alert(ml: dict[str, Any], cfg: dict[str, Any]) -> bool:
    if not cfg.get("enabled", True):
        return False
    sub = cfg.get("gru_ae") or {}
    block = ml.get("gru_ae")
    if not block:
        return False
    if not sub.get("alert_if_above_p95", True):
        return False
    th = float(sub.get("min_anomaly_01_for_alert", 0.5))
    return float(block.get("anomaly_01", 0)) >= th


def combined_anomaly_01(ml: dict[str, Any] | None) -> float | None:
    if not ml:
        return None
    xs: list[float] = []
    if "iforest" in ml and "anomaly_01" in ml["iforest"]:
        xs.append(float(ml["iforest"]["anomaly_01"]))
    if "gru_ae" in ml and "anomaly_01" in ml["gru_ae"]:
        xs.append(float(ml["gru_ae"]["anomaly_01"]))
    if not xs:
        return None
    return max(xs)


def any_model_loaded() -> bool:
    m = models_available()
    return bool(m.get("iforest") or m.get("gru_ae") or m.get("trajectory_clf"))
