"""流式告警合并：单元测试（unittest，无需 pytest）。"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.stream_dedupe import StreamAlertDeduper  # noqa: E402


class StreamDedupeTest(unittest.TestCase):
    def test_same_key_within_window_suppressed(self) -> None:
        d = StreamAlertDeduper(merge_window_sec=30.0)
        self.assertTrue(d.should_emit(1, "dwell_warning", 7, now_mono=100.0))
        self.assertFalse(d.should_emit(1, "dwell_warning", 7, now_mono=110.0))
        self.assertTrue(d.should_emit(1, "dwell_warning", 7, now_mono=131.0))

    def test_different_track_allowed(self) -> None:
        d = StreamAlertDeduper(merge_window_sec=30.0)
        self.assertTrue(d.should_emit(1, "dwell_warning", 1, now_mono=0.0))
        self.assertTrue(d.should_emit(1, "dwell_warning", 2, now_mono=1.0))


if __name__ == "__main__":
    unittest.main()
