"""复合事件告警决策：生命周期去重、分级和原因生成。"""

from __future__ import annotations

from dataclasses import dataclass

from services.behavior_analyzer import CompoundEventData


@dataclass
class AlertEvent:
    level: str
    alert_type: str
    track_id: int
    camera_id: int | None
    rule_id: int | None
    compound_event: CompoundEventData
    is_confirmed: bool
    reason: str
    reason_json: dict


class AlertEngine:
    """只接收复合事件；同一目标在离开规则范围前不会重复报警。"""

    def __init__(self) -> None:
        self._open_keys: set[tuple[int | None, int | None, int, str]] = set()

    def reset_lifecycle(self, rule_id: int | None, track_id: int) -> None:
        for key in list(self._open_keys):
            if key[1] == rule_id and key[2] == track_id:
                self._open_keys.remove(key)

    def process_compound_event(self, event: CompoundEventData) -> AlertEvent | None:
        key = (event.camera_id, event.rule.id, event.track_id, event.event_type)
        if key in self._open_keys:
            return None
        self._open_keys.add(key)
        level = self._level_for(event)
        reason = self._reason_text(event, level)
        reason_json = {**event.reason_json, "alert_level": level, "reason": reason}
        return AlertEvent(
            level=level,
            alert_type=event.event_type,
            track_id=event.track_id,
            camera_id=event.camera_id,
            rule_id=event.rule.id,
            compound_event=event,
            is_confirmed=True,
            reason=reason,
            reason_json=reason_json,
        )

    @staticmethod
    def _level_for(event: CompoundEventData) -> str:
        risk = int(event.rule.risk_level or 2)
        camera_risk = int(event.rule.camera_risk_level or 2)
        non_auth = bool(event.reason_json.get("non_authorized_time"))
        identity = event.reason_json.get("identity") or {}
        identity_status = str(identity.get("identity_status") or "unknown")
        authorization_status = str(identity.get("authorization_status") or "unknown")
        authorized_rule_ids = set(identity.get("authorized_rule_ids") or [])
        authorized_all_rules = bool(identity.get("authorized_all_rules"))
        is_rule_authorized = authorized_all_rules or (event.rule.id in authorized_rule_ids if event.rule.id is not None else authorization_status == "authorized")
        if identity_status == "blacklist":
            identity_weight = 3
        elif authorization_status in {"not_authorized", "unknown"} or not is_rule_authorized:
            identity_weight = 2
        else:
            identity_weight = 0
        event_weight = {
            "illegal_intrusion": 3,
            "tailgating": 3,
            "reverse_direction": 2,
            "suspicious_loitering": 2,
            "gathering": 1,
            "abnormal_path": 1,
        }.get(event.event_type, 1)
        score = max(risk, camera_risk) + event_weight + identity_weight + (1 if non_auth else 0)
        if score >= 8:
            return "critical"
        if score >= 6:
            return "high"
        if score >= 4:
            return "medium"
        return "low"

    @staticmethod
    def _reason_text(event: CompoundEventData, level: str) -> str:
        params = event.reason_json.get("parameters") or {}
        identity = event.reason_json.get("identity") or {}
        dwell = params.get("dwell_sec")
        time_desc = "非授权时段" if event.reason_json.get("non_authorized_time") else "授权或普通时段"
        person_name = identity.get("person_name") or "未知人员"
        auth_status = identity.get("authorization_status") or "unknown"
        dwell_text = f"，停留 {dwell}s" if dwell is not None else ""
        return (
            f"目标 {event.track_id} 于摄像头 {event.camera_id or '离线任务'} 的"
            f"「{event.rule.name}」触发 {event.event_type}{dwell_text}，"
            f"规则类型为 {event.rule.rule_type}，区域风险 {event.rule.risk_level}，"
            f"身份为 {person_name}（授权状态 {auth_status}），{time_desc}，"
            f"综合判定为 {level} 级告警。"
        )
