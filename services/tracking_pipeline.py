"""
YOLOv10 + DeepSORT：单帧检测与跟踪更新（供 video_tracker / 批处理 / API 共用）。
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from deep_sort_realtime.deepsort_tracker import DeepSort
from ultralytics import YOLO


def yolo_to_deepsort_dets(
    results0, conf_floor: float
) -> list[tuple[list[float], float, str]]:
    """
    将 ultralytics 单帧 Results 转为 deep-sort-realtime 所需格式：
    列表元素为 ( [left, top, w, h], confidence, class_name )。
    """
    out: list[tuple[list[float], float, str]] = []
    if results0.boxes is None or len(results0.boxes) == 0:
        return out
    xyxy = results0.boxes.xyxy.cpu().numpy()
    confs = results0.boxes.conf.cpu().numpy()
    for i in range(xyxy.shape[0]):
        x1, y1, x2, y2 = xyxy[i].tolist()
        c = float(confs[i])
        if c < conf_floor:
            continue
        w, h = x2 - x1, y2 - y1
        if w <= 1 or h <= 1:
            continue
        out.append(([float(x1), float(y1), float(w), float(h)], c, "person"))
    return out


@dataclass
class TrackFrame:
    """单帧中一条已确认轨迹。"""

    track_id: int
    frame_idx: int
    cx: float
    cy: float
    w: float
    h: float
    ts: float
    x1: float
    y1: float
    x2: float
    y2: float


class TrackingPipeline:
    """封装 YOLO 检测 + DeepSORT 更新，对单帧 BGR 图像返回轨迹列表。"""

    def __init__(
        self,
        weights: str = "yolov10s.pt",
        conf: float = 0.35,
        embedder_gpu: bool = False,
        max_age: int = 30,
        n_init: int = 3,
    ) -> None:
        self.conf = conf
        self.model = YOLO(weights)
        self.tracker = DeepSort(
            max_age=max_age,
            n_init=n_init,
            embedder="mobilenet",
            embedder_gpu=embedder_gpu,
            half=True,
        )

    def update_frame(
        self,
        frame_bgr: np.ndarray,
        frame_idx: int,
        ts_seconds: float,
        *,
        only_confirmed: bool = True,
    ) -> list[TrackFrame]:
        """对一帧做检测与跟踪，返回轨迹（默认仅 is_confirmed）。"""
        results = self.model.predict(
            source=frame_bgr,
            conf=self.conf,
            classes=[0],
            verbose=False,
        )[0]
        raw_dets = yolo_to_deepsort_dets(results, self.conf)
        tracks = self.tracker.update_tracks(raw_dets, frame=frame_bgr)

        out: list[TrackFrame] = []
        for t in tracks:
            if only_confirmed and not t.is_confirmed():
                continue
            ltrb = t.to_ltrb(orig=True)
            if ltrb is None:
                continue
            x1, y1, x2, y2 = map(float, ltrb)
            w = x2 - x1
            h = y2 - y1
            if w <= 1 or h <= 1:
                continue
            cx = (x1 + x2) * 0.5
            cy = (y1 + y2) * 0.5
            out.append(
                TrackFrame(
                    track_id=int(t.track_id),
                    frame_idx=frame_idx,
                    cx=cx,
                    cy=cy,
                    w=w,
                    h=h,
                    ts=ts_seconds,
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                )
            )
        return out
