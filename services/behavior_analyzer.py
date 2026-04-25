from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from services.event_builder import AtomicEventData, TrackObservation
from services.scene_rules import SceneRuleConfig, is_non_authorized_time


@dataclass(frozen=True)
class CompoundEventData:
    camera_id: int | None
    rule: SceneRuleConfig
    track_id: int
    event_type: str
    ts: float
    event_at: datetime
    reason_json: dict[str, Any]


@dataclass
class _RuleTrackState:
    inside_since: float | None = None
    last_seen_ts: float = 0.0
    prev_x: float | None = None
    prev_y: float | None = None
    low_speed_since: float | None = None
    emitted_open: set[str] = field(default_factory=set)


class BehaviorAnalyzer:
    def __init__(self) -> None:
        self._states: dict[tuple[int, int | None], _RuleTrackState] = {}
        self._door_recent: dict[int | None, list[tuple[float, int]]] = {}
        self._active_by_rule: dict[int | None, set[int]] = {}

    def observe(
        self,
        obs: TrackObservation,
        atomic_events: list[AtomicEventData],
        rules: list[SceneRuleConfig],
    ) -> list[CompoundEventData]:
        out: list[CompoundEventData] = []
        for ev in atomic_events:
            out.extend(self._from_atomic(ev))
        out.extend(self._from_dwell(obs, rules))
        return out

    def _from_atomic(self, ev: AtomicEventData) -> list[CompoundEventData]:
        st = self._states.setdefault((ev.track_id, ev.rule.id), _RuleTrackState())
        out: list[CompoundEventData] = []
        if ev.event_type.endswith("_enter") or ev.event_type in {"object_approach", "door_approach"}:
            if st.inside_since is None:
                st.inside_since = ev.ts
            active = self._active_by_rule.setdefault(ev.rule.id, set())
            active.add(ev.track_id)
            threshold = int((ev.rule.config_json or {}).get("gathering_threshold", 3))
            if ev.rule.rule_type == "area" and len(active) >= threshold:
                out.append(self._compound(ev, "gathering", {"active_tracks": sorted(active), "threshold": threshold}))
            if (ev.rule.config_json or {}).get("abnormal_on_enter"):
                out.append(self._compound(ev, "abnormal_path", {"rule_config": "abnormal_on_enter"}))
        if ev.event_type.endswith("_leave") or ev.event_type == "object_leave":
            st.inside_since = None
            st.low_speed_since = None
            st.emitted_open.clear()
            self._active_by_rule.setdefault(ev.rule.id, set()).discard(ev.track_id)
        if ev.event_type in {"line_cross", "door_enter"}:
            out.append(self._compound(ev, "illegal_intrusion", {"atomic_event": ev.event_type}))
        if ev.event_type == "direction_violation":
            out.append(self._compound(ev, "reverse_direction", {"actual": ev.payload.get("actual_direction"), "allowed": ev.payload.get("allowed_direction")}))
        if ev.event_type in {"door_enter", "line_cross"} and ev.rule.rule_type == "door":
            recent = self._door_recent.setdefault(ev.rule.id, [])
            recent[:] = [(ts, tid) for ts, tid in recent if ev.ts - ts <= 5.0]
            if all(tid != ev.track_id for _, tid in recent) and recent:
                out.append(self._compound(ev, "tailgating", {"window_sec": 5.0, "nearby_tracks": [tid for _, tid in recent]}))
            recent.append((ev.ts, ev.track_id))
        return out

    def _from_dwell(
        self,
        obs: TrackObservation,
        rules: list[SceneRuleConfig],
    ) -> list[CompoundEventData]:
        out: list[CompoundEventData] = []
        x = obs.cx / max(float(obs.frame_w), 1.0)
        y = obs.cy / max(float(obs.frame_h), 1.0)
        for rule in rules:
            st = self._states.get((obs.track_id, rule.id))
            if st is None or st.inside_since is None:
                continue
            speed = 999.0
            if st.prev_x is not None and st.prev_y is not None:
                dt = max(obs.ts - st.last_seen_ts, 1e-6)
                speed = math.hypot(x - st.prev_x, y - st.prev_y) / dt
            st.prev_x, st.prev_y, st.last_seen_ts = x, y, obs.ts
            if speed <= 0.015 and st.low_speed_since is None:
                st.low_speed_since = obs.ts
            dwell = obs.ts - st.inside_since
            slow_for = obs.ts - st.low_speed_since if st.low_speed_since is not None else 0.0
            if dwell >= rule.dwell_threshold_sec and slow_for >= min(rule.dwell_threshold_sec, 5.0):
                key = "suspicious_loitering"
                if key not in st.emitted_open:
                    st.emitted_open.add(key)
                    out.append(self._compound_from_rule(obs, rule, key, {"dwell_sec": round(dwell, 2), "low_speed_sec": round(slow_for, 2)}))
        return out

    def _compound(self, ev: AtomicEventData, event_type: str, extra: dict[str, Any]) -> CompoundEventData:
        now = datetime.now(timezone.utc)
        reason = {
            "camera_id": ev.camera_id,
            "rule_id": ev.rule.id,
            "rule_name": ev.rule.name,
            "rule_type": ev.rule.rule_type,
            "compound_event_type": event_type,
            "target_id": ev.track_id,
            "track_id": ev.track_id,
            "trigger_ts": ev.ts,
            "risk_level": ev.rule.risk_level,
            "non_authorized_time": is_non_authorized_time(ev.rule, now),
            "parameters": extra,
        }
        return CompoundEventData(ev.camera_id, ev.rule, ev.track_id, event_type, ev.ts, now, reason)

    def _compound_from_rule(
        self,
        obs: TrackObservation,
        rule: SceneRuleConfig,
        event_type: str,
        extra: dict[str, Any],
    ) -> CompoundEventData:
        now = datetime.now(timezone.utc)
        reason = {
            "camera_id": obs.camera_id,
            "rule_id": rule.id,
            "rule_name": rule.name,
            "rule_type": rule.rule_type,
            "compound_event_type": event_type,
            "target_id": obs.track_id,
            "track_id": obs.track_id,
            "trigger_ts": obs.ts,
            "risk_level": rule.risk_level,
            "non_authorized_time": is_non_authorized_time(rule, now),
            "identity": obs.identity or {"identity_status": "unknown", "authorization_status": "unknown"},
            "parameters": extra,
        }
        return CompoundEventData(obs.camera_id, rule, obs.track_id, event_type, obs.ts, now, reason)
