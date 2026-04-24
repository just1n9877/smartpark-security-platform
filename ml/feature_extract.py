from __future__ import annotations

import numpy as np

# 与 trajectory_analytics.compute_trajectory_features 输出字段一致
_FEATURE_KEYS = (
    "total_displacement_px",
    "avg_speed_px_per_s",
    "reversal_count",
    "roi_dwell_frames",
    "frame_count",
)


def features_dict_to_vector(features: dict | None) -> np.ndarray | None:
    if not features:
        return None
    try:
        vec = [float(features.get(k, 0.0) or 0.0) for k in _FEATURE_KEYS]
    except (TypeError, ValueError):
        return None
    return np.array(vec, dtype=np.float32).reshape(1, -1)


def feature_dim() -> int:
    return len(_FEATURE_KEYS)
