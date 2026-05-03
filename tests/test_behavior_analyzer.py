from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from services.behavior_analyzer import BehaviorAnalyzer  # noqa: E402
from services.event_builder import AtomicEventData, TrackObservation  # noqa: E402
from services.scene_rules import SceneRuleConfig  # noqa: E402


def _area_rule() -> SceneRuleConfig:
    return SceneRuleConfig(
        id=1,
        camera_id=1,
        name="大厅",
        rule_type="area",
        geometry={"points": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        config_json={
            "behavior": {
                "gathering": {"min_abs_count": 5, "cold_start_min_duration_sec": 15, "cold_start_cooldown_sec": 300},
                "loitering": {"dwell_time_sec": 30, "v_low_norm_per_sec": 0.008},
            }
        },
    )


def _door_rule() -> SceneRuleConfig:
    return SceneRuleConfig(
        id=2,
        camera_id=1,
        name="门禁",
        rule_type="door",
        geometry={"points": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        config_json={"behavior": {"tailgating": {"gap_threshold_sec": 1.2}}},
    )


def _obs(track_id: int, ts: float, x: float = 0.5, y: float = 0.5, identity: dict | None = None) -> TrackObservation:
    return TrackObservation(1, track_id, x * 1000, y * 1000, 20, 40, ts, 1000, 1000, identity)


def _event(rule: SceneRuleConfig, track_id: int, event_type: str, ts: float, identity: dict | None = None) -> AtomicEventData:
    return AtomicEventData(
        camera_id=1,
        rule=rule,
        track_id=track_id,
        event_type=event_type,
        ts=ts,
        event_at=datetime.now(timezone.utc),
        payload={"x": 0.5, "y": 0.5, "identity": identity},
    )


class BehaviorAnalyzerTest(unittest.TestCase):
    def test_gathering_requires_cold_start_duration(self) -> None:
        analyzer = BehaviorAnalyzer()
        rule = _area_rule()
        for track_id in range(1, 6):
            analyzer.observe(_obs(track_id, 0.0), [_event(rule, track_id, "area_enter", 0.0)], [rule])

        early = analyzer.observe(_obs(1, 10.0), [], [rule])
        self.assertFalse(any(ev.event_type == "gathering" for ev in early))

        late = []
        for sec in range(11, 27):
            late.extend(analyzer.observe(_obs(1, float(sec)), [], [rule]))
        self.assertTrue(any(ev.event_type == "gathering" for ev in late))

    def test_normal_walking_does_not_loiter(self) -> None:
        analyzer = BehaviorAnalyzer()
        rule = _area_rule()
        analyzer.observe(_obs(1, 0.0, 0.1, 0.5), [_event(rule, 1, "area_enter", 0.0)], [rule])
        events = []
        for sec in range(1, 36):
            events.extend(analyzer.observe(_obs(1, float(sec), 0.1 + 0.02 * sec, 0.5), [], [rule]))
        self.assertFalse(any(ev.event_type == "suspicious_loitering" for ev in events))

    def test_authorized_group_pass_suppresses_tailgating(self) -> None:
        analyzer = BehaviorAnalyzer()
        rule = _door_rule()
        identity = {"identity_status": "known", "authorization_status": "authorized", "authorized_rule_ids": [2]}
        analyzer.observe(_obs(1, 0.0, identity=identity), [_event(rule, 1, "door_enter", 0.0, identity)], [rule])
        events = analyzer.observe(_obs(2, 0.5, identity=identity), [_event(rule, 2, "door_enter", 0.5, identity)], [rule])
        self.assertFalse(any(ev.event_type == "tailgating" for ev in events))


if __name__ == "__main__":
    unittest.main()
