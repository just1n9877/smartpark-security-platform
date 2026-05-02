import json
import urllib.error
import urllib.parse
import urllib.request

from app.config import settings


class MediaGatewayError(RuntimeError):
    """Raised when MediaMTX cannot prepare a browser playback path."""


def _camera_path(camera_id: int) -> str:
    return f"camera-{camera_id}"


def _request(path: str, method: str, payload: dict | None = None) -> tuple[int, str]:
    url = f"{settings.mediamtx_api_url}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )

    try:
        with urllib.request.urlopen(req, timeout=settings.mediamtx_timeout_sec) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        return exc.code, detail
    except urllib.error.URLError as exc:
        raise MediaGatewayError(f"MediaMTX API request failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise MediaGatewayError("MediaMTX API request timed out") from exc


def _upsert_path(path_name: str, rtsp_url: str) -> None:
    config = {
        "source": rtsp_url,
        "sourceOnDemand": True,
        "sourceProtocol": "automatic",
    }
    encoded_name = urllib.parse.quote(path_name, safe="")
    status, detail = _request(f"/v3/config/paths/add/{encoded_name}", "POST", config)
    if 200 <= status < 300:
        return

    # MediaMTX returns an error if the path already exists; edit keeps repeated calls idempotent.
    status, edit_detail = _request(f"/v3/config/paths/edit/{encoded_name}", "POST", config)
    if 200 <= status < 300:
        return

    raise MediaGatewayError(f"MediaMTX path upsert failed: add={detail[:300]} edit={edit_detail[:300]}")


def prepare_camera_webrtc(camera_id: int, rtsp_url: str) -> dict[str, str]:
    if not settings.mediamtx_enabled:
        raise MediaGatewayError("MediaMTX is disabled")

    path_name = _camera_path(camera_id)
    _upsert_path(path_name, rtsp_url)
    public_base = settings.mediamtx_public_webrtc_url
    return {
        "path": path_name,
        "page_url": f"{public_base}/{urllib.parse.quote(path_name, safe='')}",
        "whep_url": f"{public_base}/{urllib.parse.quote(path_name, safe='')}/whep",
    }
