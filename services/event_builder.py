from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from services.scene_rules import SceneRuleConfig


@dataclass(frozen=True)
class TrackObservation:
    camera_id: int | None
    track_id: int
    cx: float
    cy: float
    w: float
    h: float
    ts: float
    frame_w: int
    frame_h: int
    identity: dict[str, Any] | None = None


@dataclass(frozen=True)
class AtomicEventData:
    camera_id: int | None
    rule: SceneRuleConfig
    track_id: int
    event_type: str
    ts: float
    event_at: datetime
    payload: dict[str, Any]


def _norm_point(obs: TrackObservation) -> tuple[float, float]:
    return obs.cx / max(float(obs.frame_w), 1.0), obs.cy / max(float(obs.frame_h), 1.0)


def _points(rule: SceneRuleConfig) -> list[tuple[float, float]]:
    raw = rule.geometry.get("points") or []
    return [(float(p[0]), float(p[1])) for p in raw if isinstance(p, (list, tuple)) and len(p) >= 2]


def _point_in_poly(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    if len(poly) < 3:
        return False
    inside = False
    j = len(poly) - 1
    for i, (xi, yi) in enumerate(poly):
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / max(yj - yi, 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def _dist_to_point(x: float, y: float, px: float, py: float) -> float:
    return math.hypot(x - px, y - py)


def _orientation(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _segments_cross(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
    d: tuple[float, float],
) -> bool:
    return (_orientation(a, b, c) * _orientation(a, b, d) < 0) and (
        _orientation(c, d, a) * _orientation(c, d, b) < 0
    )


class EventBuilder:
    def __init__(self, rules: list[SceneRuleConfig]) -> None:
        self.rules = rules
        self._inside: dict[tuple[int, int | None], bool] = {}
        self._prev_point: dict[int, tuple[float, float]] = {}

    def update_rules(self, rules: list[SceneRuleConfig]) -> None:
        self.rules = rules

    def build(self, obs: TrackObservation) -> list[AtomicEventData]:
        x, y = _norm_point(obs)
        prev = self._prev_point.get(obs.track_id)
        out: list[AtomicEventData] = []
        now = datetime.now(timezone.utc)
        for rule in self.rules:
            if not rule.is_enabled:
                continue
            key = (obs.track_id, rule.id)
            typ = rule.rule_type
            if typ in {"area", "door"}:
                inside = _point_in_poly(x, y, _points(rule))
                was = self._inside.get(key, False)
                if inside and not was:
                    out.append(self._event(obs, rule, f"{typ}_enter", now, {"x": x, "y": y}))
                if not inside and was:
                    out.append(self._event(obs, rule, f"{typ}_leave", now, {"x": x, "y": y}))
                if typ == "door" and inside:
                    out.append(self._event(obs, rule, "door_approach", now, {"x": x, "y": y}))
                self._inside[key] = inside
            elif typ == "line_crossing" and prev is not None:
                pts = _points(rule)
                if len(pts) >= 2 and _segments_cross(prev, (x, y), pts[0], pts[1]):
                    direction = "forward" if _orientation(pts[0], pts[1], prev) > 0 else "reverse"
                    out.append(self._event(obs, rule, "line_cross", now, {"direction": direction}))
            elif typ == "direction" and prev is not None:
                dx, dy = x - prev[0], y - prev[1]
                if math.hypot(dx, dy) > 0.01:
                    allowed = rule.allowed_direction or rule.geometry.get("allowed_direction")
                    actual = "left_to_right" if abs(dx) >= abs(dy) and dx >= 0 else "right_to_left" if abs(dx) >= abs(dy) else "top_to_bottom" if dy >= 0 else "bottom_to_top"
                    if allowed and actual != allowed:
                        out.append(self._event(obs, rule, "direction_violation", now, {"actual_direction": actual, "allowed_direction": allowed}))
            elif typ == "object_proximity":
                point = rule.geometry.get("point") or (rule.geometry.get("points") or [[0.5, 0.5]])[0]
                radius = float(rule.geometry.get("radius", 0.08))
                near = _dist_to_point(x, y, float(point[0]), float(point[1])) <= radius
                was = self._inside.get(key, False)
                if near and not was:
                    out.append(self._event(obs, rule, "object_approach", now, {"x": x, "y": y, "radius": radius}))
                if not near and was:
                    out.append(self._event(obs, rule, "object_leave", now, {"x": x, "y": y}))
                self._inside[key] = near
        self._prev_point[obs.track_id] = (x, y)
        return out

    @staticmethod
    def _event(
        obs: TrackObservation,
        rule: SceneRuleConfig,
        event_type: str,
        now: datetime,
        payload: dict[str, Any],
    ) -> AtomicEventData:
        return AtomicEventData(
            camera_id=obs.camera_id,
            rule=rule,
            track_id=obs.track_id,
            event_type=event_type,
            ts=obs.ts,
            event_at=now,
            payload={**payload, "rule_name": rule.name, "rule_type": rule.rule_type},
        )
