"""提前预警规则与去抖（冷却 + 连续帧确认）。"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass

import cv2
import numpy as np

from services.pipeline_config import PipelineConfig
from services.trajectory_analytics import denormalize_rect, point_in_rect


@dataclass
class AlertEvent:
    level: str
    alert_type: str
    frame_idx: int
    track_id: int
    is_confirmed: bool
    detail: str


@dataclass
class _TrackAlertState:
    in_roi_prev: bool = False
    dwell_roi_frames: int = 0
    reversal_count: int = 0
    prev_cx: float | None = None
    prev_cy: float | None = None
    vx_prev: float | None = None
    vy_prev: float | None = None
    consec_warning: int = 0
    consec_alert: int = 0
    last_alert_monotonic: float = 0.0


class AlertEngine:
    """每帧根据轨迹中心点与 ROI 更新状态，在满足去抖条件时产出告警事件。"""

    def __init__(self, cfg: PipelineConfig) -> None:
        self.cfg = cfg
        self._states: dict[int, _TrackAlertState] = {}

    def _roi_contains(self, cx: float, cy: float, fw: int, fh: int) -> bool:
        if self.cfg.roi_mode == "polygon" and self.cfg.polygon_norm:
            pts = np.array(
                [[float(x) * fw, float(y) * fh] for x, y in self.cfg.polygon_norm],
                dtype=np.float32,
            )
            return cv2.pointPolygonTest(pts, (cx, cy), False) >= 0
        x1, y1, x2, y2 = denormalize_rect(self.cfg.rect_norm, fw, fh)
        return point_in_rect(cx, cy, x1, y1, x2, y2)

    def _cooldown_ok(self, st: _TrackAlertState) -> bool:
        return (time.monotonic() - st.last_alert_monotonic) >= self.cfg.cooldown_sec

    def process_track(
        self,
        track_id: int,
        cx: float,
        cy: float,
        frame_idx: int,
        fps: float,
        frame_w: int,
        frame_h: int,
    ) -> list[AlertEvent]:
        st = self._states.setdefault(track_id, _TrackAlertState())
        in_roi = self._roi_contains(cx, cy, frame_w, frame_h)

        # 折返：速度向量与上一段点积为负
        if st.prev_cx is not None and st.prev_cy is not None:
            dx = cx - st.prev_cx
            dy = cy - st.prev_cy
            if st.vx_prev is not None and st.vy_prev is not None:
                dot = dx * st.vx_prev + dy * st.vy_prev
                n0 = math.hypot(dx, dy)
                n1 = math.hypot(st.vx_prev, st.vy_prev)
                if n0 > 2.0 and n1 > 2.0 and dot < 0:
                    st.reversal_count += 1
            st.vx_prev, st.vy_prev = dx, dy
        st.prev_cx, st.prev_cy = cx, cy

        fps = max(fps, 1e-3)

        if self.cfg.simple_intrusion_mode:
            # 与提前预警对照：进入 ROI 边沿即告警（仍受冷却约束）
            if in_roi and not st.in_roi_prev and self._cooldown_ok(st):
                st.last_alert_monotonic = time.monotonic()
                st.in_roi_prev = in_roi
                return [
                    AlertEvent(
                        level="alert",
                        alert_type="intrusion_simple",
                        frame_idx=frame_idx,
                        track_id=track_id,
                        is_confirmed=True,
                        detail="ROI edge intrusion (simple mode)",
                    )
                ]
            st.in_roi_prev = in_roi
            return []

        # 提前预警：基于停留与折返
        if in_roi:
            st.dwell_roi_frames += 1
        else:
            st.dwell_roi_frames = 0
            st.reversal_count = 0

        st.in_roi_prev = in_roi
        dwell_sec = st.dwell_roi_frames / fps

        warn_cond = dwell_sec >= self.cfg.dwell_warning_sec
        alert_cond = dwell_sec >= self.cfg.dwell_alert_sec or st.reversal_count >= self.cfg.reversal_alert_k

        if warn_cond:
            st.consec_warning += 1
        else:
            st.consec_warning = 0

        if alert_cond:
            st.consec_alert += 1
        else:
            st.consec_alert = 0

        m = self.cfg.consecutive_frames_for_escalation
        out: list[AlertEvent] = []

        # 高等级优先
        if st.consec_alert >= m and self._cooldown_ok(st):
            st.last_alert_monotonic = time.monotonic()
            st.consec_alert = 0
            st.consec_warning = 0
            detail = (
                f"dwell={dwell_sec:.2f}s rev={st.reversal_count}"
                f" (alert>={self.cfg.dwell_alert_sec}s or rev>={self.cfg.reversal_alert_k})"
            )
            out.append(
                AlertEvent(
                    level="alert",
                    alert_type="early_loitering",
                    frame_idx=frame_idx,
                    track_id=track_id,
                    is_confirmed=True,
                    detail=detail,
                )
            )
            return out

        if st.consec_warning >= m and self._cooldown_ok(st):
            st.last_alert_monotonic = time.monotonic()
            st.consec_warning = 0
            out.append(
                AlertEvent(
                    level="warning",
                    alert_type="early_dwell",
                    frame_idx=frame_idx,
                    track_id=track_id,
                    is_confirmed=True,
                    detail=f"dwell={dwell_sec:.2f}s (warning>={self.cfg.dwell_warning_sec}s)",
                )
            )
            return out

        return out
