from __future__ import annotations

import numpy as np


def points_to_sequence(
    pts: list[tuple[int, float, float, float]],
    frame_w: int,
    frame_h: int,
    seq_len: int = 48,
) -> np.ndarray:
    """(frame_idx, cx, cy, ts) → [seq_len, 2] 归一化到 [0,1]。"""
    fw = max(float(frame_w), 1.0)
    fh = max(float(frame_h), 1.0)
    if not pts:
        return np.zeros((seq_len, 2), dtype=np.float32)
    arr = np.array([[p[1] / fw, p[2] / fh] for p in pts], dtype=np.float32)
    if len(arr) == 1:
        return np.repeat(arr, seq_len, axis=0)[:seq_len]
    t_old = np.linspace(0.0, 1.0, len(arr))
    t_new = np.linspace(0.0, 1.0, seq_len)
    xs = np.interp(t_new, t_old, arr[:, 0])
    ys = np.interp(t_new, t_old, arr[:, 1])
    return np.stack([xs, ys], axis=1).astype(np.float32)
