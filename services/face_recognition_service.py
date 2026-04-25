from __future__ import annotations

import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from sqlalchemy.orm import Session

from app.models import (
    FaceProfile,
    FaceRecognitionLog,
    Person,
    PersonAuthorization,
    TrackIdentity,
)

_ROOT = Path(__file__).resolve().parents[1]
_FACE_SIZE = (32, 32)
_MATCH_THRESHOLD = 0.82


def _normalize(vec: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vec))
    if norm <= 1e-9:
        return vec
    return vec / norm


def embedding_from_image(image_bgr: np.ndarray) -> tuple[list[float], float]:
    """提取轻量本地人脸模板；无外部模型时使用灰度归一化特征作为兜底。"""
    if image_bgr.size == 0:
        return [], 0.0
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    resized = cv2.resize(gray, _FACE_SIZE, interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    vec = _normalize(resized.reshape(-1))
    quality = float(np.clip(gray.std() / 64.0, 0.0, 1.0))
    return vec.tolist(), quality


def embedding_from_file(path: str | Path) -> tuple[list[float], float]:
    img = cv2.imread(str(path))
    if img is None:
        raise ValueError("无法读取人脸图片")
    return embedding_from_image(img)


def crop_face_candidate(frame_bgr: np.ndarray, x1: float, y1: float, x2: float, y2: float) -> np.ndarray:
    h, w = frame_bgr.shape[:2]
    ix1 = max(0, min(w - 1, int(x1)))
    ix2 = max(0, min(w, int(x2)))
    iy1 = max(0, min(h - 1, int(y1)))
    iy2 = max(0, min(h, int(y1 + (y2 - y1) * 0.45)))
    if ix2 <= ix1 or iy2 <= iy1:
        return frame_bgr[0:0, 0:0]
    return frame_bgr[iy1:iy2, ix1:ix2]


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    return float(sum(x * y for x, y in zip(a, b)))


def _authorization_scope(db: Session, person_id: int) -> tuple[list[int], bool]:
    rows = (
        db.query(PersonAuthorization)
        .filter(PersonAuthorization.person_id == person_id, PersonAuthorization.is_enabled.is_(True))
        .all()
    )
    all_rules = any(r.rule_id is None for r in rows)
    return [int(r.rule_id) for r in rows if r.rule_id is not None], all_rules


def _authorization_status(person: Person | None, authorized_rule_ids: list[int], authorized_all_rules: bool) -> str:
    if person is None:
        return "unknown"
    if person.person_type == "blacklist":
        return "blacklist"
    return "authorized" if authorized_rule_ids or authorized_all_rules else "not_authorized"


def match_embedding(db: Session, embedding: list[float]) -> dict[str, Any]:
    profiles = (
        db.query(FaceProfile)
        .join(Person, Person.id == FaceProfile.person_id)
        .filter(FaceProfile.is_active.is_(True), Person.is_active.is_(True))
        .all()
    )
    best_profile: FaceProfile | None = None
    best_score = 0.0
    for profile in profiles:
        score = _cosine(embedding, list(profile.embedding_json or []))
        if score > best_score:
            best_score = score
            best_profile = profile
    if best_profile is None or best_score < _MATCH_THRESHOLD:
        return {
            "person_id": None,
            "person_name": None,
            "person_type": "unknown",
            "identity_status": "unknown",
            "authorization_status": "unknown",
            "confidence": round(best_score, 4),
            "authorized_rule_ids": [],
            "authorized_all_rules": False,
        }
    person = best_profile.person
    authorized_rule_ids, authorized_all_rules = _authorization_scope(db, person.id)
    status = "blacklist" if person.person_type == "blacklist" else "known"
    return {
        "person_id": person.id,
        "person_name": person.name,
        "person_type": person.person_type,
        "identity_status": status,
        "authorization_status": _authorization_status(person, authorized_rule_ids, authorized_all_rules),
        "confidence": round(best_score, 4),
        "authorized_rule_ids": authorized_rule_ids,
        "authorized_all_rules": authorized_all_rules,
    }


def recognize_track(
    db: Session,
    frame_bgr: np.ndarray,
    *,
    job_id: int | None,
    camera_id: int | None,
    track_id: int,
    bbox: tuple[float, float, float, float],
) -> dict[str, Any]:
    existing = (
        db.query(TrackIdentity)
        .filter(TrackIdentity.job_id == job_id, TrackIdentity.camera_id == camera_id, TrackIdentity.track_id == track_id)
        .first()
    )
    now = datetime.now(timezone.utc)
    if existing is not None and existing.details_json:
        last_seen = existing.last_seen_at.replace(tzinfo=timezone.utc) if existing.last_seen_at.tzinfo is None else existing.last_seen_at
        if (now - last_seen).total_seconds() < 2.0:
            existing.last_seen_at = now
            return dict(existing.details_json)

    crop = crop_face_candidate(frame_bgr, *bbox)
    embedding, quality = embedding_from_image(crop)
    result = match_embedding(db, embedding)
    result["quality_score"] = round(quality, 4)

    rel_path = None
    if crop.size:
        rel_path = f"storage/faces/tracks/cam{camera_id or 'job'}_tid{track_id}_{int(now.timestamp())}.jpg"
        out_abs = _ROOT.joinpath(*rel_path.split("/"))
        out_abs.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(out_abs), crop)

    if existing is None:
        existing = TrackIdentity(
            job_id=job_id,
            camera_id=camera_id,
            track_id=track_id,
            person_id=result["person_id"],
            identity_status=result["identity_status"],
            authorization_status=result["authorization_status"],
            confidence=float(result["confidence"]),
            first_seen_at=now,
            last_seen_at=now,
            evidence_path=rel_path,
            details_json=result,
        )
        db.add(existing)
    elif float(result["confidence"]) >= float(existing.confidence or 0.0):
        existing.person_id = result["person_id"]
        existing.identity_status = result["identity_status"]
        existing.authorization_status = result["authorization_status"]
        existing.confidence = float(result["confidence"])
        existing.last_seen_at = now
        existing.evidence_path = rel_path or existing.evidence_path
        existing.details_json = result
    else:
        existing.last_seen_at = now

    db.add(
        FaceRecognitionLog(
            job_id=job_id,
            camera_id=camera_id,
            track_id=track_id,
            person_id=result["person_id"],
            confidence=float(result["confidence"]),
            status=result["identity_status"],
            snapshot_path=rel_path,
        )
    )
    return result
