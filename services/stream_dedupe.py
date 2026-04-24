"""RTSP 流式告警：滑动窗口内同 (camera, type, track) 合并（跳过重复写入）。"""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class StreamAlertDeduper:
    merge_window_sec: float = 45.0
    _last_emit_mono: dict[tuple[int | None, str, int], float] = field(default_factory=dict)

    def should_emit(
        self,
        camera_id: int | None,
        alert_type: str,
        track_id: int,
        *,
        now_mono: float | None = None,
    ) -> bool:
        now = time.monotonic() if now_mono is None else now_mono
        key = (camera_id, str(alert_type), int(track_id))
        last = self._last_emit_mono.get(key)
        if last is not None and (now - last) < self.merge_window_sec:
            return False
        self._last_emit_mono[key] = now
        return True
