"""
离线训练 GRU 自编码器。
用法（项目根）:
  set PYTHONPATH=backend
  python -m ml.train_gru_ae
"""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(_ROOT / "backend"))

from app.database import SessionLocal  # noqa: E402
from ml.paths import active_bundle_dir  # noqa: E402
from ml.train_ops import run_gru_ae_training  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        ok, msg = run_gru_ae_training(db, active_bundle_dir(), restrict_job_ids=None)
        print(msg if ok else f"SKIP: {msg}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
