"""从轨迹点序列计算摘要特征（位移、速度、折返、ROI 停留帧数）。"""

from __future__ import annotations

import math
from typing import Any, Callable, Sequence


def denormalize_rect(rect_norm: Sequence[float], w: int, h: int) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = rect_norm
    return x1 * w, y1 * h, x2 * w, y2 * h


def point_in_rect(cx: float, cy: float, x1: float, y1: float, x2: float, y2: float) -> bool:
    return x1 <= cx <= x2 and y1 <= cy <= y2


def compute_trajectory_features(
    points: list[tuple[int, float, float, float]],
    fps: float,
    roi_predicate: Callable[[float, float], bool] | None,
) -> dict[str, Any]:
    """
    points: (frame_idx, cx, cy, ts_sec) 按 frame 升序。
    返回 features_json 用字典：总位移(px)、平均速度(px/s)、折返次数、ROI 内停留帧数。
    """
    if len(points) < 2:
        dwell = 0
        if roi_predicate and points:
            dwell = 1 if roi_predicate(points[0][1], points[0][2]) else 0
        return {
            "total_displacement_px": 0.0,
            "avg_speed_px_per_s": 0.0,
            "reversal_count": 0,
            "roi_dwell_frames": dwell,
            "frame_count": len(points),
            "fps_estimate": fps,
        }

    total_disp = 0.0
    reversals = 0
    prev_cx, prev_cy = points[0][1], points[0][2]
    vx_prev: float | None = None
    vy_prev: float | None = None
    roi_dwell = 0

    for i in range(1, len(points)):
        cx, cy = points[i][1], points[i][2]
        dx = cx - prev_cx
        dy = cy - prev_cy
        total_disp += math.hypot(dx, dy)
        if vx_prev is not None and vy_prev is not None:
            dot = dx * vx_prev + dy * vy_prev
            n0 = math.hypot(dx, dy)
            n1 = math.hypot(vx_prev, vy_prev)
            if n0 > 2.0 and n1 > 2.0 and dot < 0:
                reversals += 1
        vx_prev, vy_prev = dx, dy
        prev_cx, prev_cy = cx, cy

    if roi_predicate:
        for _, cx, cy, _ in points:
            if roi_predicate(cx, cy):
                roi_dwell += 1

    t0, t1 = points[0][3], points[-1][3]
    dt = max(t1 - t0, 1e-6)
    avg_speed = total_disp / dt

    return {
        "total_displacement_px": round(total_disp, 3),
        "avg_speed_px_per_s": round(avg_speed, 3),
        "reversal_count": reversals,
        "roi_dwell_frames": roi_dwell,
        "frame_count": len(points),
        "fps_estimate": fps,
    }
