from __future__ import annotations

from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def models_dir() -> Path:
    d = project_root() / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d


def versions_root() -> Path:
    d = models_dir() / "versions"
    d.mkdir(parents=True, exist_ok=True)
    return d


def active_version_file() -> Path:
    return models_dir() / "active_version.txt"


def get_active_version_id() -> str | None:
    p = active_version_file()
    if not p.exists():
        return None
    s = p.read_text(encoding="utf-8").strip()
    return s or None


def version_dir(version_id: str) -> Path:
    return versions_root() / version_id


def active_bundle_dir() -> Path:
    """当前生效模型目录：versions/<id>；否则回退 legacy 扁平 models/。"""
    vid = get_active_version_id()
    if vid:
        vd = version_dir(vid)
        if (vd / "manifest.json").exists() or (vd / "iforest.joblib").exists():
            return vd
    return models_dir()


def iforest_path() -> Path:
    return active_bundle_dir() / "iforest.joblib"


def gru_ae_path() -> Path:
    return active_bundle_dir() / "gru_ae.pt"


def trajectory_clf_path() -> Path:
    return active_bundle_dir() / "trajectory_clf.pt"


def manifest_path() -> Path:
    return active_bundle_dir() / "manifest.json"


def ml_inference_config_path() -> Path:
    return project_root() / "config" / "ml_inference.yaml"
