"""RTSP 多路拉流：复用检测/跟踪/规则引擎；告警写入 DB（带合并）。"""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from app.database import SessionLocal
from app.model_registry import sync_active_version_from_db
from app.models import Alert, Camera
from app.system_config_service import effective_config_for_pipeline, get_or_create_system_config
from services.alert_engine import AlertEngine
from services.stream_dedupe import StreamAlertDeduper
from services.tracking_pipeline import TrackingPipeline

_ROOT = Path(__file__).resolve().parents[1]

_workers: dict[int, threading.Thread] = {}
_stop_flags: dict[int, threading.Event] = {}


def _run_camera_loop(camera_id: int) -> None:
    db = SessionLocal()
    try:
        cam = db.query(Camera).filter(Camera.id == camera_id).first()
        if cam is None or not cam.rtsp_url:
            print(f"[rtsp] camera {camera_id} missing or no rtsp_url")
            return
        sync_active_version_from_db(db)
        cfg = effective_config_for_pipeline(db)
        row = get_or_create_system_config(db)
        merge_sec = float(row.stream_alert_merge_sec or 45.0)
    finally:
        db.close()

    deduper = StreamAlertDeduper(merge_window_sec=merge_sec)
    cap = cv2.VideoCapture(cam.rtsp_url)
    if not cap.isOpened():
        print(f"[rtsp] cannot open {cam.rtsp_url}")
        return

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 15.0)
    if fps <= 1e-3:
        fps = 15.0
    fw = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
    fh = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720

    track_pipe = TrackingPipeline(
        weights=cfg.weights,
        conf=cfg.conf,
        embedder_gpu=cfg.embedder_gpu,
    )
    alert_engine = AlertEngine(cfg)
    stop = _stop_flags.get(camera_id) or threading.Event()
    max_frames = int(os.getenv("STREAM_DEMO_MAX_FRAMES", "0"))
    frame_idx = 0
    while not stop.is_set():
        ok, frame = cap.read()
        if not ok:
            time.sleep(0.05)
            continue
        frame_idx += 1
        if max_frames > 0 and frame_idx > max_frames:
            break
        ts = frame_idx / fps
        tracks = track_pipe.update_frame(frame, frame_idx, ts)
        db = SessionLocal()
        try:
            for tr in tracks:
                for ev in alert_engine.process_track(tr.track_id, tr.cx, tr.cy, tr.frame_idx, fps, fw, fh):
                    if not deduper.should_emit(camera_id, ev.alert_type, tr.track_id):
                        continue
                    rel = f"storage/frames/rtsp{camera_id}_tid{tr.track_id}_f{frame_idx}.jpg"
                    out_abs = _ROOT.joinpath(*rel.split("/"))
                    out_abs.parent.mkdir(parents=True, exist_ok=True)
                    cv2.imwrite(str(out_abs), frame)
                    db.add(
                        Alert(
                            job_id=None,
                            level=ev.level,
                            alert_type=ev.alert_type,
                            triggered_at=datetime.now(timezone.utc),
                            track_id=tr.track_id,
                            camera_id=camera_id,
                            keyframe_path=rel.replace("\\", "/"),
                            is_confirmed=ev.is_confirmed,
                        )
                    )
                    db.commit()
        finally:
            db.close()

    cap.release()
    print(f"[rtsp] camera {camera_id} loop ended")


def start_camera_stream(camera_id: int) -> bool:
    if camera_id in _workers and _workers[camera_id].is_alive():
        return False
    db = SessionLocal()
    try:
        row = get_or_create_system_config(db)
        max_w = int(row.rtsp_max_workers or 4)
        alive = sum(1 for t in _workers.values() if t.is_alive())
        if alive >= max_w:
            print(f"[rtsp] at worker cap {max_w}")
            return False
    finally:
        db.close()

    ev = threading.Event()
    _stop_flags[camera_id] = ev

    def _wrap() -> None:
        try:
            _run_camera_loop(camera_id)
        finally:
            _stop_flags.pop(camera_id, None)
            _workers.pop(camera_id, None)

    t = threading.Thread(target=_wrap, daemon=True)
    _workers[camera_id] = t
    t.start()
    return True


def stop_camera_stream(camera_id: int) -> None:
    ev = _stop_flags.get(camera_id)
    if ev:
        ev.set()


def active_stream_camera_ids() -> list[int]:
    return [cid for cid, th in _workers.items() if th.is_alive()]
