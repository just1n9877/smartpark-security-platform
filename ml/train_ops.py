"""训练管线：写入指定版本目录（IsolationForest + GRU-AE + 可选多类头）。"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import torch
import torch.nn as nn
from sklearn.ensemble import IsolationForest
from torch.utils.data import DataLoader, TensorDataset

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(_ROOT / "backend"))

from sqlalchemy.orm import Session

from app.models import AnalysisJob, JobStatus  # noqa: E402
from ml.dataset_db import (  # noqa: E402
    benign_track_pairs,
    iter_summaries_completed_jobs,
    labeled_track_feedback_map,
    load_points_for_track,
)
from ml.feature_extract import features_dict_to_vector  # noqa: E402
from ml.gru_ae import TrajectoryGRUAutoEncoder  # noqa: E402
from ml.gru_classifier import TrajectoryGRUClassifier  # noqa: E402
from ml.label_mapping import CLASS_NAMES, label_to_idx  # noqa: E402
from ml.sequence import points_to_sequence  # noqa: E402


def _merge_manifest(out_dir: Path, key: str, payload: dict[str, Any]) -> None:
    mp = out_dir / "manifest.json"
    data: dict[str, Any] = {}
    if mp.exists():
        data = json.loads(mp.read_text(encoding="utf-8"))
    data["trained_at"] = datetime.now(timezone.utc).isoformat()
    data[key] = payload
    mp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _frame_size_for_job(db: Session, job_id: int) -> tuple[int, int]:
    from app.models import TrajectoryPoint

    j = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if j and j.frame_width and j.frame_height:
        return int(j.frame_width), int(j.frame_height)
    pts = db.query(TrajectoryPoint).filter(TrajectoryPoint.job_id == job_id).all()
    if not pts:
        return 1920, 1080
    max_cx = max(p.cx + p.w * 0.5 for p in pts)
    max_cy = max(p.cy + p.h * 0.5 for p in pts)
    return int(max(max_cx * 1.05, 640)), int(max(max_cy * 1.05, 360))


def run_iforest_training(
    db: Session,
    out_dir: Path,
    *,
    restrict_job_ids: set[int] | None = None,
) -> tuple[bool, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    benign = benign_track_pairs(db)
    summaries = iter_summaries_completed_jobs(db, restrict_job_ids=restrict_job_ids)
    use_benign = len(benign) >= 20
    if use_benign:
        summaries = [s for s in summaries if (s.job_id, s.track_id) in benign]
    X_list: list[np.ndarray] = []
    for s in summaries:
        v = features_dict_to_vector(s.features_json or {})
        if v is not None:
            X_list.append(v.ravel())
    if len(X_list) < 5:
        return False, "iforest: need >=5 feature rows"
    X = np.stack(X_list, axis=0)
    clf = IsolationForest(n_estimators=200, contamination="auto", random_state=42, n_jobs=-1)
    clf.fit(X)
    samples = clf.score_samples(X)
    smin, smax = float(samples.min()), float(samples.max())
    joblib.dump(
        {"model": clf, "score_min": smin, "score_max": smax, "n_fit": len(X)},
        out_dir / "iforest.joblib",
    )
    _merge_manifest(
        out_dir,
        "iforest",
        {
            "n_fit": len(X),
            "benign_only": use_benign,
            "score_min": smin,
            "score_max": smax,
            "n_estimators": 200,
        },
    )
    return True, f"iforest ok n={len(X)}"


def run_gru_ae_training(
    db: Session,
    out_dir: Path,
    *,
    restrict_job_ids: set[int] | None = None,
) -> tuple[bool, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    seq_len, hidden, latent = 48, 64, 16
    epochs, lr = 25, 1e-3
    device = torch.device("cpu")

    benign = benign_track_pairs(db)
    summaries = iter_summaries_completed_jobs(db, restrict_job_ids=restrict_job_ids)
    use_benign = len(benign) >= 15
    if use_benign:
        summaries = [s for s in summaries if (s.job_id, s.track_id) in benign]

    seqs: list[np.ndarray] = []
    job_sizes: dict[int, tuple[int, int]] = {}
    for s in summaries:
        if s.job_id not in job_sizes:
            j = db.query(AnalysisJob).filter(AnalysisJob.id == s.job_id).first()
            if not j or j.status != JobStatus.completed:
                continue
            job_sizes[s.job_id] = _frame_size_for_job(db, s.job_id)
        fw, fh = job_sizes[s.job_id]
        pts = load_points_for_track(db, s.job_id, s.track_id)
        if len(pts) < 2:
            continue
        seqs.append(points_to_sequence(pts, fw, fh, seq_len=seq_len))
    if len(seqs) < 5:
        return False, "gru_ae: need >=5 sequences"
    X = np.stack(seqs, axis=0)
    tensor = torch.from_numpy(X).float()
    loader = DataLoader(TensorDataset(tensor, tensor), batch_size=min(32, len(tensor)), shuffle=True)

    model = TrajectoryGRUAutoEncoder(seq_len=seq_len, input_dim=2, hidden=hidden, latent=latent).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()
    model.train()
    for ep in range(epochs):
        for batch_x, _ in loader:
            batch_x = batch_x.to(device)
            opt.zero_grad()
            recon = model(batch_x)
            loss = loss_fn(recon, batch_x)
            loss.backward()
            opt.step()

    model.eval()
    with torch.no_grad():
        full = model(tensor.to(device)).cpu().numpy()
        mse = np.mean((full - X) ** 2, axis=(1, 2))
    p95 = float(np.percentile(mse, 95))

    torch.save(
        {
            "state_dict": model.state_dict(),
            "seq_len": seq_len,
            "hidden": hidden,
            "latent": latent,
            "mse_p95": p95,
            "train_tracks": len(seqs),
        },
        out_dir / "gru_ae.pt",
    )
    _merge_manifest(
        out_dir,
        "gru_ae",
        {
            "seq_len": seq_len,
            "hidden": hidden,
            "latent": latent,
            "mse_p95": p95,
            "train_tracks": len(seqs),
            "benign_only": use_benign,
            "epochs": epochs,
        },
    )
    return True, f"gru_ae ok tracks={len(seqs)}"


def run_classifier_training(
    db: Session,
    out_dir: Path,
    *,
    restrict_job_ids: set[int] | None = None,
) -> tuple[bool, str]:
    """多类头：需 Feedback 与 (job,track) 对齐；样本过少则跳过（返回 ok False 但不致命）。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    labels_map = labeled_track_feedback_map(db, restrict_job_ids=restrict_job_ids)
    seq_len, hidden = 48, 64
    device = torch.device("cpu")
    xs: list[np.ndarray] = []
    ys: list[int] = []
    for (jid, tid), lab in labels_map.items():
        pts = load_points_for_track(db, jid, tid)
        if len(pts) < 2:
            continue
        fw, fh = _frame_size_for_job(db, jid)
        xs.append(points_to_sequence(pts, fw, fh, seq_len=seq_len))
        ys.append(label_to_idx(lab))
    if len(xs) < 5:
        return False, "classifier: need >=5 labeled sequences (fallback: deploy without clf)"
    X = np.stack(xs, axis=0)
    y = np.array(ys, dtype=np.int64)
    tensor_x = torch.from_numpy(X).float()
    tensor_y = torch.from_numpy(y).long()
    loader = DataLoader(
        TensorDataset(tensor_x, tensor_y),
        batch_size=min(32, len(tensor_x)),
        shuffle=True,
    )
    model = TrajectoryGRUClassifier(
        seq_len=seq_len, num_classes=len(CLASS_NAMES), input_dim=2, hidden=hidden
    ).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.CrossEntropyLoss()
    model.train()
    for _ep in range(40):
        for bx, by in loader:
            bx, by = bx.to(device), by.to(device)
            opt.zero_grad()
            logits = model(bx)
            loss = loss_fn(logits, by)
            loss.backward()
            opt.step()
    model.eval()
    torch.save(
        {
            "state_dict": model.state_dict(),
            "seq_len": seq_len,
            "hidden": hidden,
            "class_names": CLASS_NAMES,
            "n_fit": len(xs),
        },
        out_dir / "trajectory_clf.pt",
    )
    _merge_manifest(
        out_dir,
        "trajectory_clf",
        {"seq_len": seq_len, "hidden": hidden, "n_fit": len(xs), "classes": CLASS_NAMES},
    )
    return True, f"classifier ok n={len(xs)}"
