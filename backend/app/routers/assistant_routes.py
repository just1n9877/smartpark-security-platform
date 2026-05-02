import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deepseek_client import DeepSeekError, chat_with_deepseek, is_deepseek_configured
from app.deps import get_current_user
from app.models import Alert, AssistantMessage, Camera, SceneRule, User
from app.schemas import AssistantRequest, AssistantResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def _dt(value: object) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else None


def _assistant_context(db: Session) -> dict:
    cameras = db.query(Camera).order_by(Camera.id.asc()).all()
    active_cameras = [c for c in cameras if c.is_active]
    enabled_rules = (
        db.query(SceneRule)
        .filter(SceneRule.is_enabled.is_(True))
        .order_by(SceneRule.id.asc())
        .limit(10)
        .all()
    )
    recent_alerts = db.query(Alert).order_by(Alert.triggered_at.desc()).limit(5).all()
    alerts_total = db.query(Alert).count()
    pending_alerts = db.query(Alert).filter(Alert.is_confirmed.is_(False)).count()
    critical_alerts = db.query(Alert).filter(Alert.level.in_(["critical", "high"])).count()

    return {
        "summary": {
            "alerts_total": alerts_total,
            "pending_alerts": pending_alerts,
            "critical_or_high_alerts": critical_alerts,
            "cameras_total": len(cameras),
            "active_cameras": len(active_cameras),
            "enabled_rules": db.query(SceneRule).filter(SceneRule.is_enabled.is_(True)).count(),
        },
        "active_cameras_sample": [
            {
                "id": camera.id,
                "name": camera.name,
                "location": camera.location,
                "risk_level": camera.risk_level,
                "has_rtsp_url": bool(camera.rtsp_url),
            }
            for camera in active_cameras[:8]
        ],
        "enabled_rules_sample": [
            {
                "id": rule.id,
                "name": rule.name,
                "rule_type": rule.rule_type,
                "camera_id": rule.camera_id,
                "risk_level": rule.risk_level,
            }
            for rule in enabled_rules
        ],
        "recent_alerts": [
            {
                "id": alert.id,
                "level": alert.level,
                "alert_type": alert.alert_type,
                "camera_id": alert.camera_id,
                "is_confirmed": alert.is_confirmed,
                "triggered_at": _dt(alert.triggered_at),
                "reason": alert.reason,
            }
            for alert in recent_alerts
        ],
    }


def _answer_from_context(message: str, db: Session) -> tuple[str, list[str]]:
    text = message.lower()
    alerts_total = db.query(Alert).count()
    pending_alerts = db.query(Alert).filter(Alert.is_confirmed.is_(False)).count()
    critical_alerts = db.query(Alert).filter(Alert.level.in_(["critical", "high"])).count()
    cameras = db.query(Camera).order_by(Camera.id.asc()).all()
    active_cameras = [c for c in cameras if c.is_active]
    rules_count = db.query(SceneRule).filter(SceneRule.is_enabled.is_(True)).count()
    if any(k in text for k in ["告警", "报警", "处置", "处理"]):
        answer = (
            f"当前系统共有 {alerts_total} 条告警，其中 {pending_alerts} 条待确认，"
            f"{critical_alerts} 条属于紧急或严重级别。建议先查看紧急/严重告警的证据帧和原因，"
            "确认是否为真实告警；如果是误报，请在告警详情中提交或修改最终反馈，系统会把反馈沉淀为后续优化样本。"
        )
        return answer, ["打开告警中心", "筛选紧急告警", "查看误报反馈"]

    if any(k in text for k in ["摄像头", "设备", "在线", "监控"]):
        names = "、".join(c.name for c in active_cameras[:5]) or "暂无启用摄像头"
        answer = (
            f"当前登记摄像头 {len(cameras)} 个，启用 {len(active_cameras)} 个。"
            f"前几个启用点位是：{names}。如果要查看画面，请进入实时监控页点击具体摄像头；"
            "如果没有 RTSP 地址，系统只能展示配置状态，不能播放真实画面。"
        )
        return answer, ["进入实时监控", "添加摄像头", "检查 RTSP 地址"]

    if any(k in text for k in ["规则", "禁区", "区域", "门", "方向"]):
        answer = (
            f"当前启用的场景规则有 {rules_count} 条。系统支持区域、越线、门/入口、方向、敏感点靠近五类规则。"
            "规则负责产生原子事件，只有行为分析模块把事件序列判断为徘徊、入侵、逆行、尾随等复合事件后，才会生成告警。"
        )
        return answer, ["配置场景规则", "查看规则风险等级", "检查摄像头绑定"]

    if any(k in text for k in ["状态", "态势", "今天", "今日", "报告"]):
        answer = (
            f"安全态势摘要：摄像头 {len(cameras)} 个，启用 {len(active_cameras)} 个，"
            f"告警总数 {alerts_total} 条，待确认 {pending_alerts} 条。"
            "建议先处理高等级告警，再检查未配置规则或未绑定摄像头的任务。"
        )
        return answer, ["生成安全摘要", "查看待确认告警", "查看摄像头状态"]

    answer = (
        "我可以基于当前系统数据回答使用问题、告警处置建议、设备状态解释、规则配置说明。"
        "你可以问：有哪些待处理告警、摄像头是否在线、为什么触发某类告警、如何降低误报。"
    )
    return answer, ["有哪些待处理告警？", "查看摄像头在线状态", "如何配置禁区规则？"]


@router.post("/chat", response_model=AssistantResponse)
def chat(
    body: AssistantRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssistantResponse:
    db.add(AssistantMessage(user_id=user.id, role="user", content=body.message))
    fallback_answer, suggestions = _answer_from_context(body.message, db)
    answer = fallback_answer
    source = "local_rules_no_deepseek_key"

    if is_deepseek_configured():
        try:
            answer, deepseek_suggestions = chat_with_deepseek(body.message, _assistant_context(db))
            suggestions = deepseek_suggestions or suggestions
            source = "deepseek"
        except DeepSeekError as exc:
            logger.warning("DeepSeek assistant fallback: %s", exc)
            source = "local_rules_deepseek_error"
            answer = fallback_answer

    db.add(AssistantMessage(user_id=user.id, role="assistant", content=answer, created_at=datetime.now(timezone.utc)))
    db.commit()
    return AssistantResponse(answer=answer, suggestions=suggestions, source=source)
