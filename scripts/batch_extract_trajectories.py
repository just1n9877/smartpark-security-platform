"""
递归扫描 mp4，为每个视频创建 AnalysisJob 并同步跑轨迹/摘要/告警流水线。

默认根目录由环境变量 DATASET_VIDEO_ROOT 指定；未设置时使用
`<项目根>/data/RepCount/video/train`（若不存在则仅打印提示）。

用法（在项目根目录、已激活 venv）::

    set PYTHONPATH=backend
    python scripts/batch_extract_trajectories.py --root path\\to\\videos

或::

    set DATASET_VIDEO_ROOT=D:\\datasets\\RepCount\\video\\train
    python scripts/batch_extract_trajectories.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))
sys.path.insert(0, str(_ROOT / "backend"))

from app.database import SessionLocal, ensure_sqlite_migrations  # noqa: E402
from app.models import AnalysisJob, JobStatus  # noqa: E402
from services.pipeline_runner import run_pipeline_for_job  # noqa: E402


def main() -> None:
    default_root = os.environ.get(
        "DATASET_VIDEO_ROOT",
        str(_ROOT / "data" / "RepCount" / "video" / "train"),
    )
    p = argparse.ArgumentParser(description="Batch trajectory extraction for mp4 under a root.")
    p.add_argument(
        "--root",
        type=Path,
        default=None,
        help=f"mp4 root (default: env DATASET_VIDEO_ROOT or {default_root})",
    )
    p.add_argument(
        "--config",
        type=Path,
        default=None,
        help="override config/pipeline_alerts.yaml",
    )
    args = p.parse_args()
    root = args.root or Path(default_root)
    if not root.is_dir():
        print(f"[batch] skip: not a directory: {root}")
        sys.exit(1)
    mp4s = sorted(root.rglob("*.mp4"))
    if not mp4s:
        print(f"[batch] no mp4 under {root}")
        sys.exit(0)

    ensure_sqlite_migrations()
    db = SessionLocal()
    try:
        for v in mp4s:
            job = AnalysisJob(video_path=str(v.resolve()), status=JobStatus.pending)
            db.add(job)
            db.commit()
            db.refresh(job)
            print(f"[batch] job_id={job.id} video={v}")
            run_pipeline_for_job(job.id, v, config_path=args.config)
    finally:
        db.close()


if __name__ == "__main__":
    main()
