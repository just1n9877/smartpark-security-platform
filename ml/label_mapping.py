"""与 FeedbackLabel 对齐 + unknown；多类头输出顺序固定。"""

from __future__ import annotations

CLASS_NAMES: list[str] = [
    "unknown",
    "false_positive",
    "delivery",
    "visitor",
    "work",
    "suspicious",
    "other",
]


def label_to_idx(name: str) -> int:
    try:
        return CLASS_NAMES.index(name)
    except ValueError:
        return 0


def idx_to_label(i: int) -> str:
    if 0 <= i < len(CLASS_NAMES):
        return CLASS_NAMES[i]
    return "unknown"
