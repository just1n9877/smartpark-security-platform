"""
子任务1：YOLOv10 + DeepSORT 视频行人跟踪
========================================
在工程根目录运行（保证 ./data、./outputs 路径正确）：
    python video_tracker.py
    python video_tracker.py --video ./data/videos/test.mp4

依赖安装（在项目根目录、已激活虚拟环境后执行）：
    pip install -r requirements.txt

若尚未单独安装 DeepSORT 封装库，可执行：
    pip install deep-sort-realtime

说明：
    - ultralytics 负责 YOLOv10 检测；deep-sort-realtime 提供 DeepSort 跟踪器与外观特征提取（默认 MobileNet）。
    - 仅检测 COCO 类别 0（person）。无 CUDA 时请将 --embedder-gpu 设为 0，避免 embedder 尝试使用 GPU。
"""

from __future__ import annotations

import argparse
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from deep_sort_realtime.deepsort_tracker import DeepSort
from ultralytics import YOLO

from services.tracking_pipeline import yolo_to_deepsort_dets


def _project_root() -> Path:
    return Path(__file__).resolve().parent


def _parse_args() -> argparse.Namespace:
    root = _project_root()
    p = argparse.ArgumentParser(description="YOLOv10 + DeepSORT 行人视频跟踪")
    p.add_argument(
        "--video",
        type=Path,
        default=root / "data" / "videos" / "test.mp4",
        help="输入视频路径（默认 ./data/videos/test.mp4）",
    )
    p.add_argument(
        "--output",
        type=Path,
        default=root / "outputs" / "tracked_video.mp4",
        help="输出视频路径（默认 ./outputs/tracked_video.mp4）",
    )
    p.add_argument(
        "--weights",
        default="yolov10s.pt",
        help="YOLOv10 权重（默认 yolov10s.pt，首次运行自动下载）",
    )
    p.add_argument("--conf", type=float, default=0.35, help="检测置信度阈值")
    p.add_argument(
        "--embedder-gpu",
        type=int,
        choices=(0, 1),
        default=0,
        help="DeepSORT 外观网络是否用 GPU：1=是，0=否（无显卡请用 0）",
    )
    p.add_argument(
        "--fps-window",
        type=int,
        default=30,
        help="FPS 平滑窗口（最近 N 帧的平均帧时间）",
    )
    return p.parse_args()


def draw_hud(frame: np.ndarray, fps: float, person_count: int) -> None:
    """左上角：FPS 与当前跟踪到的人数（仅统计已确认轨迹）。"""
    line1 = f"FPS: {fps:.1f}"
    line2 = f"Persons: {person_count}"
    x0, y0 = 10, 28
    for i, text in enumerate((line1, line2)):
        y = y0 + i * 32
        cv2.putText(
            frame,
            text,
            (x0, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 0, 0),
            4,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            text,
            (x0, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )


def main() -> None:
    args = _parse_args()
    root = _project_root()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    video_path = args.video.resolve()
    if not video_path.is_file():
        raise SystemExit(
            f"找不到输入视频: {video_path}\n"
            f"请将测试视频放到 data/videos/ 下并命名为 test.mp4，或使用 --video 指定路径。"
        )

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise SystemExit(f"无法打开视频: {video_path}")

    fps_src = cap.get(cv2.CAP_PROP_FPS)
    if fps_src is None or fps_src <= 1e-3:
        fps_src = 25.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(args.output.resolve()), fourcc, fps_src, (w, h))
    if not writer.isOpened():
        raise SystemExit(f"无法创建输出视频: {args.output}")

    # DeepSORT：MobileNet 外观 + 卡尔曼滤波；无 GPU 时 embedder_gpu=False
    tracker = DeepSort(
        max_age=30,
        n_init=3,
        embedder="mobilenet",
        embedder_gpu=bool(args.embedder_gpu),
        half=True,
    )

    model = YOLO(args.weights)

    times: deque[float] = deque(maxlen=max(1, args.fps_window))
    t_wall = time.perf_counter()

    frame_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1

        t0 = time.perf_counter()
        # 仅行人；verbose=False 减少控制台刷屏
        results = model.predict(
            source=frame,
            conf=args.conf,
            classes=[0],
            verbose=False,
        )[0]

        raw_dets = yolo_to_deepsort_dets(results, args.conf)
        tracks = tracker.update_tracks(raw_dets, frame=frame)

        times.append(time.perf_counter() - t0)
        fps_disp = 1.0 / (sum(times) / len(times)) if times else 0.0

        confirmed = [t for t in tracks if t.is_confirmed()]
        draw_hud(frame, fps_disp, len(confirmed))

        for t in confirmed:
            ltrb = t.to_ltrb(orig=True)
            if ltrb is None:
                continue
            x1, y1, x2, y2 = map(int, ltrb)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 0), 2)
            label = f"Person #{t.track_id}"
            cv2.putText(
                frame,
                label,
                (x1, max(0, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

        writer.write(frame)

    cap.release()
    writer.release()
    elapsed = time.perf_counter() - t_wall
    print(f"完成：共处理 {frame_idx} 帧，用时 {elapsed:.1f}s")
    print(f"输出已保存: {args.output.resolve()}")


if __name__ == "__main__":
    main()
