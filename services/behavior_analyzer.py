from __future__ import annotations

import math
from collections import deque
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


@dataclass(frozen=True)
class _TrackSample:
    ts: float
    x: float
    y: float


@dataclass
class _RuleTrackState:
    inside_since: float | None = None
    last_seen_ts: float = 0.0
    prev_x: float | None = None
    prev_y: float | None = None
    low_speed_since: float | None = None
    samples: deque[_TrackSample] = field(default_factory=lambda: deque(maxlen=1200))
    emitted_open: set[str] = field(default_factory=set)


@dataclass
class _GatherStats:
    baseline: float = 0.0
    sigma: float = 1.0
    initialized: bool = False
    first_ts: float | None = None
    above_since: float | None = None
    last_emit_ts: float = -1e9


class BehaviorAnalyzer:
    def __init__(self) -> None:
        self._states: dict[tuple[int, int | None], _RuleTrackState] = {}
        self._door_recent: dict[int | None, list[dict[str, Any]]] = {}
        self._active_by_rule: dict[int | None, set[int]] = {}
        self._gather_stats: dict[int | None, _GatherStats] = {}
        self._rule_count_history: dict[int | None, deque[tuple[float, int]]] = {}
        self._compound_last_emit: dict[tuple[int | None, str], float] = {}

    @staticmethod
    def _cfg(rule: SceneRuleConfig, section: str, key: str, default: Any) -> Any:
        cfg = rule.config_json or {}
        behavior = cfg.get("behavior") if isinstance(cfg.get("behavior"), dict) else {}
        scoped = behavior.get(section) if isinstance(behavior.get(section), dict) else {}
        if key in scoped:
            return scoped[key]
        if key in cfg:
            return cfg[key]
        return default

    def _cooldown_ok(self, rule_id: int | None, event_type: str, ts: float, cooldown: float) -> bool:
        key = (rule_id, event_type)
        last = self._compound_last_emit.get(key, -1e9)
        if ts - last < cooldown:
            return False
        self._compound_last_emit[key] = ts
        return True

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
            window = float(self._cfg(ev.rule, "tailgating", "context_window_sec", 10.0))
            recent[:] = [item for item in recent if ev.ts - float(item["ts"]) <= window]
            tailgating = self._tailgating_event(ev, recent)
            if tailgating is not None:
                out.append(tailgating)
            recent.append(
                {
                    "ts": ev.ts,
                    "track_id": ev.track_id,
                    "x": ev.payload.get("x"),
                    "y": ev.payload.get("y"),
                    "identity": ev.payload.get("identity") or {},
                }
            )
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
            v_low = float(self._cfg(rule, "loitering", "v_low_norm_per_sec", 0.008))
            if speed <= v_low and st.low_speed_since is None:
                st.low_speed_since = obs.ts
            if speed > v_low:
                st.low_speed_since = None
            st.samples.append(_TrackSample(obs.ts, x, y))
            window = float(self._cfg(rule, "loitering", "window_sec", 30.0))
            while st.samples and obs.ts - st.samples[0].ts > max(window, 1.0):
                st.samples.popleft()
            gathering = self._gathering_event(obs, rule)
            if gathering is not None:
                out.append(gathering)
            dwell = obs.ts - st.inside_since
            slow_for = obs.ts - st.low_speed_since if st.low_speed_since is not None else 0.0
            loiter = self._loitering_features(st, rule, obs.ts)
            dwell_threshold = float(self._cfg(rule, "loitering", "dwell_time_sec", max(rule.dwell_threshold_sec, 30.0)))
            if dwell >= dwell_threshold and loiter["is_loitering"]:
                key = "suspicious_loitering"
                cooldown = float(self._cfg(rule, "loitering", "cooldown_sec", 300.0))
                if key not in st.emitted_open and self._cooldown_ok(rule.id, key, obs.ts, cooldown):
                    st.emitted_open.add(key)
                    out.append(
                        self._compound_from_rule(
                            obs,
                            rule,
                            key,
                            {
                                "dwell_sec": round(dwell, 2),
                                "low_speed_sec": round(slow_for, 2),
                                **loiter,
                            },
                        )
                    )
        return out

    def _gathering_event(
        self,
        obs: TrackObservation,
        rule: SceneRuleConfig,
    ) -> CompoundEventData | None:
        if rule.rule_type != "area":
            return None
        active_ids = sorted(self._active_by_rule.get(rule.id, set()))
        if not active_ids:
            return None
        count = len(active_ids)
        smooth_sec = float(self._cfg(rule, "gathering", "smooth_window_sec", 5.0))
        history = self._rule_count_history.setdefault(rule.id, deque())
        history.append((obs.ts, count))
        while history and obs.ts - history[0][0] > smooth_sec:
            history.popleft()
        smoothed = sorted(c for _, c in history)[len(history) // 2]

        stats = self._gather_stats.setdefault(rule.id, _GatherStats())
        if stats.first_ts is None:
            stats.first_ts = obs.ts
        min_abs = int(self._cfg(rule, "gathering", "min_abs_count", (rule.config_json or {}).get("gathering_threshold", 5)))
        k_sigma = float(self._cfg(rule, "gathering", "k_sigma", 2.5))
        ratio_threshold = float(self._cfg(rule, "gathering", "ratio_threshold", 1.7))
        observed_sec = obs.ts - (stats.first_ts or obs.ts)
        cold_sec = float(self._cfg(rule, "gathering", "cold_start_observation_sec", 24 * 3600.0))
        is_cold = observed_sec < cold_sec

        if not stats.initialized:
            stats.baseline = float(smoothed)
            stats.sigma = 1.0
            stats.initialized = True
        else:
            normal_threshold = max(min_abs, math.ceil(stats.baseline + k_sigma * stats.sigma))
            normal_above = smoothed >= normal_threshold and smoothed >= stats.baseline * ratio_threshold
            if not normal_above:
                baseline_alpha = float(self._cfg(rule, "gathering", "baseline_alpha", 0.08))
                sigma_alpha = float(self._cfg(rule, "gathering", "sigma_alpha", 0.08))
                deviation = abs(float(smoothed) - stats.baseline)
                stats.baseline = (1 - baseline_alpha) * stats.baseline + baseline_alpha * float(smoothed)
                stats.sigma = max(1.0, (1 - sigma_alpha) * stats.sigma + sigma_alpha * deviation)

        dynamic_threshold = max(min_abs, math.ceil(stats.baseline + k_sigma * stats.sigma))
        if is_cold:
            dynamic_threshold = min_abs
        above = smoothed >= dynamic_threshold if is_cold else smoothed >= dynamic_threshold and smoothed >= stats.baseline * ratio_threshold
        if above:
            if stats.above_since is None:
                stats.above_since = obs.ts
        else:
            stats.above_since = None
            return None

        min_duration = float(
            self._cfg(
                rule,
                "gathering",
                "cold_start_min_duration_sec" if is_cold else "min_duration_sec",
                15.0 if is_cold else 10.0,
            )
        )
        if obs.ts - stats.above_since < min_duration:
            return None
        cooldown = float(
            self._cfg(
                rule,
                "gathering",
                "cold_start_cooldown_sec" if is_cold else "cooldown_sec",
                300.0 if is_cold else 180.0,
            )
        )
        if obs.ts - stats.last_emit_ts < cooldown:
            return None
        stats.last_emit_ts = obs.ts
        return self._compound_from_rule(
            obs,
            rule,
            "gathering",
            {
                "active_tracks": active_ids,
                "count": count,
                "smoothed_count": smoothed,
                "baseline": round(stats.baseline, 2),
                "sigma": round(stats.sigma, 2),
                "threshold": dynamic_threshold,
                "min_duration_sec": min_duration,
                "cold_start": is_cold,
            },
        )

    def _loitering_features(self, st: _RuleTrackState, rule: SceneRuleConfig, now_ts: float) -> dict[str, Any]:
        samples = list(st.samples)
        if len(samples) < 3:
            return {"is_loitering": False, "avg_speed": None, "displacement_radius": None, "turn_count_10s": 0}
        elapsed = max(samples[-1].ts - samples[0].ts, 1e-6)
        path = sum(math.hypot(b.x - a.x, b.y - a.y) for a, b in zip(samples, samples[1:]))
        net = math.hypot(samples[-1].x - samples[0].x, samples[-1].y - samples[0].y)
        avg_speed = path / elapsed
        cx = sum(p.x for p in samples) / len(samples)
        cy = sum(p.y for p in samples) / len(samples)
        radius = max(math.hypot(p.x - cx, p.y - cy) for p in samples)
        compactness = net / max(path, 1e-6)

        angle_threshold = math.radians(float(self._cfg(rule, "loitering", "effective_turn_angle_deg", 60.0)))
        hold_sec = float(self._cfg(rule, "loitering", "effective_turn_hold_sec", 0.5))
        recent = [p for p in samples if now_ts - p.ts <= 10.0]
        turn_count = 0
        last_vec: tuple[float, float] | None = None
        last_turn_ts = -1e9
        for a, b in zip(recent, recent[1:]):
            if b.ts - a.ts < hold_sec:
                continue
            vec = (b.x - a.x, b.y - a.y)
            mag = math.hypot(*vec)
            if mag <= 1e-6:
                continue
            vec = (vec[0] / mag, vec[1] / mag)
            if last_vec is not None:
                dot = max(-1.0, min(1.0, last_vec[0] * vec[0] + last_vec[1] * vec[1]))
                if math.acos(dot) >= angle_threshold and b.ts - last_turn_ts >= hold_sec:
                    turn_count += 1
                    last_turn_ts = b.ts
            last_vec = vec

        v_low = float(self._cfg(rule, "loitering", "v_low_norm_per_sec", 0.008))
        radius_max = float(self._cfg(rule, "loitering", "max_displacement_radius", 0.08))
        turn_min = int(self._cfg(rule, "loitering", "turn_count_min_per_10s", 4))
        compactness_max = float(self._cfg(rule, "loitering", "compactness_max", 0.35))
        is_loitering = avg_speed <= v_low and radius <= radius_max and (turn_count >= turn_min or compactness <= compactness_max)
        return {
            "is_loitering": is_loitering,
            "avg_speed": round(avg_speed, 4),
            "displacement_radius": round(radius, 4),
            "compactness": round(compactness, 4),
            "turn_count_10s": turn_count,
        }

    def _tailgating_event(self, ev: AtomicEventData, recent: list[dict[str, Any]]) -> CompoundEventData | None:
        if not recent:
            return None
        gap_threshold = float(self._cfg(ev.rule, "tailgating", "gap_threshold_sec", 1.2))
        candidates = [item for item in recent if 0 < ev.ts - float(item["ts"]) <= gap_threshold]
        if not candidates:
            return None
        current_identity = ev.payload.get("identity") or {}
        all_authorized = self._is_rule_authorized(current_identity, ev.rule.id) and all(
            self._is_rule_authorized(item.get("identity") or {}, ev.rule.id) for item in candidates
        )
        if all_authorized:
            return None
        score = 0.8
        group_like = self._group_like_pass(ev, candidates)
        if group_like:
            score -= float(self._cfg(ev.rule, "tailgating", "peak_hour_score_discount", 0.05))
        threshold = float(self._cfg(ev.rule, "tailgating", "score_threshold", 0.75))
        cooldown = float(self._cfg(ev.rule, "tailgating", "cooldown_sec", 60.0))
        if score < threshold or not self._cooldown_ok(ev.rule.id, "tailgating", ev.ts, cooldown):
            return None
        return self._compound(
            ev,
            "tailgating",
            {
                "window_sec": float(self._cfg(ev.rule, "tailgating", "context_window_sec", 10.0)),
                "gap_threshold_sec": gap_threshold,
                "nearby_tracks": [int(item["track_id"]) for item in candidates],
                "score": round(score, 3),
                "group_like": group_like,
                "all_authorized_group": all_authorized,
            },
        )

    def _group_like_pass(self, ev: AtomicEventData, candidates: list[dict[str, Any]]) -> bool:
        spacing = float(self._cfg(ev.rule, "tailgating", "group_spacing_norm", 0.12))
        x = ev.payload.get("x")
        y = ev.payload.get("y")
        if x is None or y is None:
            return False
        for item in candidates:
            ix, iy = item.get("x"), item.get("y")
            if ix is None or iy is None:
                continue
            if math.hypot(float(x) - float(ix), float(y) - float(iy)) <= spacing:
                return True
        return False

    @staticmethod
    def _is_rule_authorized(identity: dict[str, Any], rule_id: int | None) -> bool:
        if not identity:
            return False
        if identity.get("identity_status") == "blacklist":
            return False
        if bool(identity.get("authorized_all_rules")):
            return True
        authorized_rule_ids = set(identity.get("authorized_rule_ids") or [])
        if rule_id is not None and rule_id in authorized_rule_ids:
            return True
        if rule_id is not None and str(rule_id) in authorized_rule_ids:
            return True
        return identity.get("authorization_status") == "authorized"

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
            "identity": ev.payload.get("identity") or {"identity_status": "unknown", "authorization_status": "unknown"},
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
