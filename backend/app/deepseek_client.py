import json
import urllib.error
import urllib.request

from app.config import settings


class DeepSeekError(RuntimeError):
    """Raised when the DeepSeek chat API cannot return a usable answer."""


def is_deepseek_configured() -> bool:
    return bool(settings.deepseek_api_key)


def _system_prompt(context: dict) -> str:
    context_json = json.dumps(context, ensure_ascii=False, default=str, indent=2)
    return (
        "你是 SmartGuard 智慧园区安防平台的 AI 助手。\n"
        "你需要用中文回答，语气专业、简洁、可执行。\n"
        "只能基于用户问题和给定系统上下文回答，不要编造摄像头画面、人员身份、告警证据或实时状态。\n"
        "如果上下文不足以确认事实，请明确说明，并给出下一步应查看的系统页面或数据。\n"
        "涉及安全处置时，优先建议查看证据帧、告警原因、摄像头状态和人工确认反馈。\n\n"
        "请只返回 JSON，不要返回 Markdown 代码块。格式：\n"
        '{"answer":"给用户看的完整回答","suggestions":["下一步操作1","下一步操作2","下一步操作3"]}\n'
        "suggestions 最多 4 个，每个不超过 16 个中文字符。\n\n"
        f"当前系统上下文：\n{context_json}"
    )


def _clean_suggestions(value: object) -> list[str]:
    if not isinstance(value, list):
        return []

    suggestions: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text or text in seen:
            continue
        suggestions.append(text[:32])
        seen.add(text)
        if len(suggestions) >= 4:
            break
    return suggestions


def _parse_assistant_content(content: str) -> tuple[str, list[str]]:
    text = content.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return text, []

    if not isinstance(data, dict):
        return text, []

    answer = data.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        return text, []
    return answer.strip(), _clean_suggestions(data.get("suggestions"))


def chat_with_deepseek(message: str, context: dict) -> tuple[str, list[str]]:
    if not settings.deepseek_api_key:
        raise DeepSeekError("DEEPSEEK_API_KEY is not configured")

    payload = {
        "model": settings.deepseek_model,
        "messages": [
            {"role": "system", "content": _system_prompt(context)},
            {"role": "user", "content": message},
        ],
        "temperature": settings.deepseek_temperature,
        "response_format": {"type": "json_object"},
        "stream": False,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        settings.deepseek_api_url,
        data=body,
        headers={
            "Authorization": f"Bearer {settings.deepseek_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=settings.deepseek_timeout_sec) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise DeepSeekError(f"DeepSeek API HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise DeepSeekError(f"DeepSeek API request failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise DeepSeekError("DeepSeek API request timed out") from exc

    try:
        data = json.loads(raw)
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise DeepSeekError("DeepSeek API returned an unexpected response") from exc

    if not isinstance(content, str) or not content.strip():
        raise DeepSeekError("DeepSeek API returned an empty answer")
    return _parse_assistant_content(content)
