from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import torch

from ml.feature_extract import features_dict_to_vector
from ml.gru_ae import TrajectoryGRUAutoEncoder
from ml.gru_classifier import TrajectoryGRUClassifier
from ml.label_mapping import CLASS_NAMES, idx_to_label
from ml.paths import gru_ae_path, iforest_path, manifest_path, trajectory_clf_path


@lru_cache(maxsize=1)
def _load_manifest() -> dict[str, Any]:
    p = manifest_path()
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _load_iforest_bundle() -> dict | None:
    p = iforest_path()
    if not p.exists():
        return None
    return joblib.load(p)


def _torch_load_compat(path: Path) -> dict:
    try:
        return torch.load(str(path), map_location="cpu", weights_only=False)
    except TypeError:
        return torch.load(str(path), map_location="cpu")


@lru_cache(maxsize=1)
def _load_classifier_bundle() -> dict | None:
    p = trajectory_clf_path()
    if not p.exists():
        return None
    ckpt = _torch_load_compat(p)
    seq_len = int(ckpt["seq_len"])
    hidden = int(ckpt["hidden"])
    ncls = len(ckpt.get("class_names", CLASS_NAMES))
    model = TrajectoryGRUClassifier(seq_len=seq_len, num_classes=ncls, input_dim=2, hidden=hidden)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    return {**ckpt, "model": model}


@lru_cache(maxsize=1)
def _load_gru_bundle() -> dict | None:
    p = gru_ae_path()
    if not p.exists():
        return None
    ckpt = _torch_load_compat(p)
    seq_len = int(ckpt["seq_len"])
    hidden = int(ckpt["hidden"])
    latent = int(ckpt["latent"])
    model = TrajectoryGRUAutoEncoder(seq_len=seq_len, input_dim=2, hidden=hidden, latent=latent)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    return {**ckpt, "model": model}


def clear_model_cache() -> None:
    _load_manifest.cache_clear()
    _load_iforest_bundle.cache_clear()
    _load_gru_bundle.cache_clear()
    _load_classifier_bundle.cache_clear()


def score_trajectory(
    features_json: dict | None,
    sequence_xy: np.ndarray,
    *,
    manifest_version: str | None = None,
) -> dict[str, Any]:
    """
    sequence_xy: [seq_len, 2] float32 归一化坐标。
    返回写入 trajectory_summaries.ml_scores_json 的结构。
    """
    out: dict[str, Any] = {}
    man = _load_manifest()
    ver = manifest_version or man.get("trained_at", "unknown")

    bundle = _load_iforest_bundle()
    if bundle is not None:
        clf = bundle["model"]
        smin = float(bundle.get("score_min", -1.0))
        smax = float(bundle.get("score_max", 1.0))
        X = features_dict_to_vector(features_json)
        if X is not None:
            pred = int(clf.predict(X)[0])
            ss = float(clf.score_samples(X)[0])
            span = smax - smin + 1e-9
            normal_01 = max(0.0, min(1.0, (ss - smin) / span))
            anomaly_01 = max(0.0, min(1.0, 1.0 - normal_01))
            out["iforest"] = {
                "is_outlier": pred == -1,
                "score_samples": ss,
                "anomaly_01": round(anomaly_01, 4),
                "manifest_version": ver,
            }

    g = _load_gru_bundle()
    if g is not None:
        model: TrajectoryGRUAutoEncoder = g["model"]
        seq_len = int(g["seq_len"])
        p95 = float(g.get("mse_p95", 0.01) or 0.01)
        x = sequence_xy.astype(np.float32)
        if x.shape[0] != seq_len:
            # 简单对齐（不应常发生）
            if x.shape[0] > seq_len:
                x = x[:seq_len]
            else:
                pad = np.zeros((seq_len - x.shape[0], 2), dtype=np.float32)
                x = np.vstack([x, pad])
        xt = torch.from_numpy(x).unsqueeze(0)
        with torch.no_grad():
            recon = model(xt).numpy()
        mse = float(np.mean((recon - x.reshape(1, seq_len, 2)) ** 2))
        anomaly_01 = max(0.0, min(1.0, mse / (p95 * 1.5 + 1e-9)))
        out["gru_ae"] = {
            "reconstruction_mse": round(mse, 6),
            "anomaly_01": round(anomaly_01, 4),
            "train_mse_p95": p95,
            "manifest_version": ver,
        }

    cb = _load_classifier_bundle()
    if cb is not None:
        model: TrajectoryGRUClassifier = cb["model"]
        seq_len = int(cb["seq_len"])
        x = sequence_xy.astype(np.float32)
        if x.shape[0] != seq_len:
            if x.shape[0] > seq_len:
                x = x[:seq_len]
            else:
                pad = np.zeros((seq_len - x.shape[0], 2), dtype=np.float32)
                x = np.vstack([x, pad])
        xt = torch.from_numpy(x).unsqueeze(0)
        with torch.no_grad():
            logits = model(xt).numpy().ravel()
        ex = np.exp(logits - np.max(logits))
        prob = ex / (ex.sum() + 1e-9)
        top3_idx = np.argsort(-prob)[:3]
        out["identity_head"] = {
            "top_k": [
                {"label": idx_to_label(int(i)), "prob": round(float(prob[i]), 4)}
                for i in top3_idx
            ],
            "logits": [round(float(z), 4) for z in logits.tolist()],
            "manifest_version": ver,
        }

    return out


def models_available() -> dict[str, bool]:
    return {
        "iforest": iforest_path().exists(),
        "gru_ae": gru_ae_path().exists(),
        "trajectory_clf": trajectory_clf_path().exists(),
        "manifest": manifest_path().exists(),
    }


def default_seq_len_for_gru() -> int:
    g = _load_gru_bundle()
    if g is not None:
        return int(g["seq_len"])
    c = _load_classifier_bundle()
    if c is not None:
        return int(c["seq_len"])
    return 48
