"""
子任务2：在 YOLOv10 + DeepSORT 基础上增加「虚拟禁区」入侵检测
================================================================
运行示例（工程根目录）：
    python video_surveillance_system.py
    python video_surveillance_system.py --video ./data/videos/demo.mp4 --zone 400 200 800 500

依赖同 video_tracker.py（含 deep-sort-realtime）。安装：
    pip install -r requirements.txt

子任务3（演示建议）：
    用手机横屏录制约 15s：人物从远处走向画面，最终踏入禁区矩形。
    根据分辨率调整 --zone 四个数 (x1 y1 x2 y2)，使禁区落在人物必经路径上；
    可先跑一帧截图或用播放器看像素坐标再改参数。
"""

from __future__ import annotations

import argparse
import time
from collections import deque
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from deep_sort_realtime.deepsort_tracker import DeepSort
from ultralytics import YOLO

from services.tracking_pipeline import yolo_to_deepsort_dets


def _project_root() -> Path:
    return Path(__file__).resolve().parent


def iou_xyxy(a: np.ndarray, b: np.ndarray) -> float:
    """
    计算两轴对齐矩形 IoU。a、b 格式均为 [x1, y1, x2, y2]。
    若仅判断是否重叠，IoU > 0 等价于存在正面积交集。
    """
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return float(inter / union) if union > 0 else 0.0


def clamp_zone_to_frame(
    zone: tuple[int, int, int, int], w: int, h: int
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = zone
    x1 = int(np.clip(x1, 0, w - 1))
    x2 = int(np.clip(x2, 0, w - 1))
    y1 = int(np.clip(y1, 0, h - 1))
    y2 = int(np.clip(y2, 0, h - 1))
    if x2 < x1:
        x1, x2 = x2, x1
    if y2 < y1:
        y1, y2 = y2, y1
    return x1, y1, x2, y2


def draw_zone_overlay(
    frame: np.ndarray,
    zone_xyxy: tuple[int, int, int, int],
    alpha: float = 0.35,
) -> None:
    """在 frame 上绘制红色半透明禁区（原地修改）。"""
    x1, y1, x2, y2 = zone_xyxy
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 0, 255), thickness=-1)
    cv2.addWeighted(overlay, alpha, frame, 1.0 - alpha, 0, dst=frame)
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)


def draw_hud(frame: np.ndarray, fps: float, person_count: int) -> None:
    line1 = f"FPS: {fps:.1f}"
    line2 = f"Persons: {person_count}"
    x0, y0 = 10, 28
    for i, text in enumerate((line1, line2)):
        y = y0 + i * 32
        cv2.putText(
            frame, text, (x0, y), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 4, cv2.LINE_AA
        )
        cv2.putText(
            frame, text, (x0, y), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2, cv2.LINE_AA
        )


def draw_alert_banner(frame: np.ndarray, text: str = "INTRUSION ALERT") -> None:
    """画面顶部全局红色警报横幅（可选）。"""
    h, w = frame.shape[:2]
    bh = max(36, h // 14)
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, bh), (0, 0, 200), thickness=-1)
    cv2.addWeighted(overlay, 0.5, frame, 0.5, 0, dst=frame)
    cv2.putText(
        frame,
        text,
        (w // 2 - 180, int(bh * 0.72)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )


def _parse_args() -> argparse.Namespace:
    root = _project_root()
    p = argparse.ArgumentParser(description="YOLOv10 + DeepSORT + 虚拟禁区入侵检测")
    p.add_argument(
        "--video",
        type=Path,
        default=root / "data" / "videos" / "test.mp4",
        help="输入视频路径",
    )
    p.add_argument(
        "--output",
        type=Path,
        default=root / "outputs" / "surveillance_output.mp4",
        help="输出视频路径",
    )
    p.add_argument("--weights", default="yolov10s.pt", help="YOLOv10 权重")
    p.add_argument("--conf", type=float, default=0.35, help="检测置信度阈值")
    p.add_argument(
        "--zone",
        type=int,
        nargs=4,
        metavar=("X1", "Y1", "X2", "Y2"),
        default=[400, 200, 800, 500],
        help="禁区矩形，左上右下像素坐标 x1 y1 x2 y2",
    )
    p.add_argument(
        "--embedder-gpu",
        type=int,
        choices=(0, 1),
        default=0,
        help="DeepSORT embedder 是否使用 GPU：1/0",
    )
    p.add_argument("--fps-window", type=int, default=30, help="FPS 平滑窗口帧数")
    p.add_argument(
        "--zone-alpha",
        type=float,
        default=0.35,
        help="禁区半透明填充透明度（0~1）",
    )
    p.add_argument(
        "--no-banner",
        action="store_true",
        help="关闭顶部全局警报横幅（仍保留单目标 INTRUSION 文字与红框）",
    )
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    video_path = args.video.resolve()
    if not video_path.is_file():
        raise SystemExit(
            f"找不到输入视频: {video_path}\n"
            "请将手机拍摄的演示视频放入 data/videos/ 或使用 --video 指定。"
        )

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise SystemExit(f"无法打开视频: {video_path}")

    fps_src = cap.get(cv2.CAP_PROP_FPS)
    if fps_src is None or fps_src <= 1e-3:
        fps_src = 25.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    zone = clamp_zone_to_frame(tuple(args.zone), w, h)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(args.output.resolve()), fourcc, fps_src, (w, h))
    if not writer.isOpened():
        raise SystemExit(f"无法创建输出视频: {args.output}")

    tracker = DeepSort(
        max_age=30,
        n_init=3,
        embedder="mobilenet",
        embedder_gpu=bool(args.embedder_gpu),
        half=True,
    )
    model = YOLO(args.weights)

    times: deque[float] = deque(maxlen=max(1, args.fps_window))
    zone_arr = np.array(zone, dtype=np.float32)

    # 记录「当前是否已在禁区内」用于边沿触发日志，避免每帧重复打印
    intruding_prev: dict[int, bool] = {}

    frame_idx = 0
    t_wall = time.perf_counter()

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1

        t0 = time.perf_counter()
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

        draw_zone_overlay(frame, zone, alpha=args.zone_alpha)

        confirmed = [t for t in tracks if t.is_confirmed()]
        draw_hud(frame, fps_disp, len(confirmed))

        any_intrusion = False
        active_ids: set[int] = set()

        for t in confirmed:
            ltrb = t.to_ltrb(orig=True)
            if ltrb is None:
                continue
            x1, y1, x2, y2 = map(int, ltrb)
            box = np.array([float(x1), float(y1), float(x2), float(y2)], dtype=np.float32)
            iou = iou_xyxy(box, zone_arr)
            intruding = iou > 0.0
            active_ids.add(t.track_id)

            if intruding:
                any_intrusion = True
                color = (0, 0, 255)
                prev = intruding_prev.get(t.track_id, False)
                if not prev:
                    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    print(f"[{ts}] 跟踪ID [{t.track_id}] 入侵禁区")
                intruding_prev[t.track_id] = True
            else:
                color = (0, 200, 0)
                intruding_prev[t.track_id] = False

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label = f"Person #{t.track_id}"
            cv2.putText(
                frame,
                label,
                (x1, max(0, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                color,
                2,
                cv2.LINE_AA,
            )
            if intruding:
                cv2.putText(
                    frame,
                    "INTRUSION!",
                    (x1, max(0, y1 - 32)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (0, 0, 255),
                    2,
                    cv2.LINE_AA,
                )

        # 清理已消失轨迹的状态，防止 ID 复用时误判
        dead = set(intruding_prev.keys()) - active_ids
        for tid in dead:
            del intruding_prev[tid]

        if any_intrusion and not args.no_banner:
            draw_alert_banner(frame)

        writer.write(frame)

    cap.release()
    writer.release()
    elapsed = time.perf_counter() - t_wall
    print(f"完成：共 {frame_idx} 帧，用时 {elapsed:.1f}s，输出: {args.output.resolve()}")


if __name__ == "__main__":
    main()
