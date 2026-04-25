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
from app.models import Alert, AlertCorrelation, AtomicEvent, Camera, CompoundEvent, ZoneTopology
from app.system_config_service import effective_config_for_pipeline, get_or_create_system_config
from services.alert_engine import AlertEngine
from services.behavior_analyzer import BehaviorAnalyzer
from services.event_builder import EventBuilder, TrackObservation
from services.face_recognition_service import recognize_track
from services.scene_rules import load_scene_rules
from services.stream_dedupe import StreamAlertDeduper
from services.tracking_pipeline import TrackingPipeline

_ROOT = Path(__file__).resolve().parents[1]

_workers: dict[int, threading.Thread] = {}
_stop_flags: dict[int, threading.Event] = {}


def _add_alert_enhancements(db, alert: Alert) -> None:
    if alert.rule_id is None:
        return
    for link in db.query(ZoneTopology).filter(ZoneTopology.zone_a_id == alert.rule_id).all():
        db.add(
            AlertCorrelation(
                primary_alert_id=alert.id,
                related_alert_id=None,
                camera_id=None,
                relation_type="topology_enhancement",
                details_json={
                    "zone_b_id": link.zone_b_id,
                    "time_window_sec": link.time_window_sec,
                    "message": "触发告警后建议联动查看拓扑相邻区域/摄像头。",
                },
            )
        )


def _run_camera_loop(camera_id: int) -> None:
    db = SessionLocal()
    try:
        cam = db.query(Camera).filter(Camera.id == camera_id).first()
        if cam is None or not cam.rtsp_url:
            print(f"[rtsp] camera {camera_id} missing or no rtsp_url")
            return
        sync_active_version_from_db(db)
        cfg = effective_config_for_pipeline(db)
        rules = load_scene_rules(db, camera_id, cfg)
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
    event_builder = EventBuilder(rules)
    behavior_analyzer = BehaviorAnalyzer()
    alert_engine = AlertEngine()
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
                identity = recognize_track(
                    db,
                    frame,
                    job_id=None,
                    camera_id=camera_id,
                    track_id=tr.track_id,
                    bbox=(tr.x1, tr.y1, tr.x2, tr.y2),
                )
                obs = TrackObservation(
                    camera_id=camera_id,
                    track_id=tr.track_id,
                    cx=tr.cx,
                    cy=tr.cy,
                    w=tr.w,
                    h=tr.h,
                    ts=ts,
                    frame_w=fw,
                    frame_h=fh,
                    identity=identity,
                )
                atomic_events = event_builder.build(obs)
                for ae in atomic_events:
                    db.add(
                        AtomicEvent(
                            job_id=None,
                            camera_id=camera_id,
                            rule_id=ae.rule.id,
                            track_id=ae.track_id,
                            event_type=ae.event_type,
                            event_ts=ae.ts,
                            event_at=ae.event_at,
                            payload_json=ae.payload,
                        )
                    )
                    if ae.event_type.endswith("_leave") or ae.event_type == "object_leave":
                        alert_engine.reset_lifecycle(ae.rule.id, ae.track_id)
                for ce in behavior_analyzer.observe(obs, atomic_events, rules):
                    ce_row = CompoundEvent(
                        job_id=None,
                        camera_id=camera_id,
                        rule_id=ce.rule.id,
                        track_id=ce.track_id,
                        event_type=ce.event_type,
                        event_ts=ce.ts,
                        event_at=ce.event_at,
                        reason_json=ce.reason_json,
                        is_open=True,
                    )
                    db.add(ce_row)
                    db.flush()
                    ev = alert_engine.process_compound_event(ce)
                    if ev is None:
                        continue
                    if not deduper.should_emit(camera_id, ev.alert_type, tr.track_id):
                        continue
                    rel = f"storage/frames/rtsp{camera_id}_tid{tr.track_id}_f{frame_idx}.jpg"
                    out_abs = _ROOT.joinpath(*rel.split("/"))
                    out_abs.parent.mkdir(parents=True, exist_ok=True)
                    cv2.imwrite(str(out_abs), frame)
                    alert = Alert(
                            job_id=None,
                            level=ev.level,
                            alert_type=ev.alert_type,
                            triggered_at=datetime.now(timezone.utc),
                            track_id=tr.track_id,
                            camera_id=camera_id,
                            rule_id=ev.rule_id,
                            compound_event_id=ce_row.id,
                            keyframe_path=rel.replace("\\", "/"),
                            reason=ev.reason,
                            reason_json=ev.reason_json,
                            is_confirmed=ev.is_confirmed,
                        )
                    db.add(alert)
                    db.flush()
                    _add_alert_enhancements(db, alert)
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
