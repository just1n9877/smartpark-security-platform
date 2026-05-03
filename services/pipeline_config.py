"""加载 config/pipeline_alerts.yaml。"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass
class PipelineConfig:
    raw: dict[str, Any]
    roi_mode: str
    rect_norm: list[float]
    polygon_norm: list[list[float]] | None
    dwell_warning_sec: float
    dwell_alert_sec: float
    reversal_alert_k: int
    simple_intrusion_mode: bool
    cooldown_sec: float
    consecutive_frames_for_escalation: int
    weights: str
    conf: float
    embedder_gpu: bool
    batch_insert_frames: int
    behavior: dict[str, Any]


def default_config_path(project_root: Path) -> Path:
    return project_root / "config" / "pipeline_alerts.yaml"


def load_pipeline_config(path: Path | None, project_root: Path) -> PipelineConfig:
    p = path or default_config_path(project_root)
    with p.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    roi = raw.get("roi") or {}
    ew = raw.get("early_warning") or {}
    db = raw.get("debounce") or {}
    vid = raw.get("video") or {}
    return PipelineConfig(
        raw=raw,
        roi_mode=str(roi.get("mode", "rectangle")),
        rect_norm=list(roi.get("rect_norm", [0.0, 0.0, 1.0, 1.0])),
        polygon_norm=roi.get("polygon_norm"),
        dwell_warning_sec=float(ew.get("dwell_warning_sec", 2.0)),
        dwell_alert_sec=float(ew.get("dwell_alert_sec", 5.0)),
        reversal_alert_k=int(ew.get("reversal_alert_k", 5)),
        simple_intrusion_mode=bool(ew.get("simple_intrusion_mode", False)),
        cooldown_sec=float(db.get("cooldown_sec", 10.0)),
        consecutive_frames_for_escalation=int(db.get("consecutive_frames_for_escalation", 5)),
        weights=str(vid.get("weights", "yolov10s.pt")),
        conf=float(vid.get("conf", 0.35)),
        embedder_gpu=bool(int(vid.get("embedder_gpu", 0))),
        batch_insert_frames=int(raw.get("batch_insert_frames", 500)),
        behavior=raw.get("behavior") or {},
    )
