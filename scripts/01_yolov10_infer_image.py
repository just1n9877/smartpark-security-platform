"""
第一步：加载 COCO 预训练 YOLOv10，对单张图片推理并保存带框可视化结果。

推荐权重（Ultralytics 首次运行自动下载到用户目录缓存）：
  - yolov10n.pt  最小最快，适合先跑通、笔记本 CPU 演示
  - yolov10s.pt  速度与精度折中
  - yolov10m.pt  报告/答辩演示画质更好

COCO 中「人」的类别 id 为 0，可用 --classes 0 只画行人框。
"""

from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urlparse

from ultralytics import YOLO


def _stem_from_source(source: str) -> str:
    if source.startswith("http://") or source.startswith("https://"):
        path = urlparse(source).path
        stem = Path(path).stem
        return stem if stem else "sample"
    return Path(source).stem


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    default_out = root / "outputs" / "images"

    p = argparse.ArgumentParser(description="YOLOv10 单图检测并保存可视化")
    p.add_argument(
        "--weights",
        default="yolov10n.pt",
        help="权重名或本地 .pt 路径（如 yolov10s.pt）；会自动下载官方 COCO 权重",
    )
    p.add_argument(
        "--source",
        default="https://ultralytics.com/images/bus.jpg",
        help="图片路径、本地文件或 URL",
    )
    p.add_argument(
        "--out-dir",
        type=Path,
        default=default_out,
        help="保存可视化结果的目录",
    )
    p.add_argument("--conf", type=float, default=0.25, help="置信度阈值")
    p.add_argument(
        "--classes",
        type=int,
        nargs="*",
        default=None,
        help="只保留指定 COCO 类别 id，例如只检测行人: --classes 0",
    )
    args = p.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    stem = _stem_from_source(str(args.source))

    model = YOLO(args.weights)
    results = model.predict(
        source=args.source,
        conf=args.conf,
        classes=args.classes,
        save=False,
        verbose=True,
    )

    for i, r in enumerate(results):
        out_path = args.out_dir / f"{stem}_yolov10_{i}.jpg"
        r.save(filename=str(out_path))
        print(f"已保存: {out_path}")


if __name__ == "__main__":
    main()
