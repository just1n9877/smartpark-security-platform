"""模型版本指针：DB active_model_version ↔ models/active_version.txt；推理进程读文件。"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.system_config_service import get_or_create_system_config


def active_version_file() -> Path:
    d = settings.project_root / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d / "active_version.txt"


def write_active_version_pointer(version_id: str | None) -> None:
    p = active_version_file()
    if not version_id:
        if p.exists():
            p.unlink()
        return
    p.write_text(version_id.strip(), encoding="utf-8")


def sync_active_version_from_db(db: Session) -> None:
    row = get_or_create_system_config(db)
    write_active_version_pointer(row.active_model_version)


def activate_model_version(db: Session, version_id: str) -> None:
    vd = settings.project_root / "models" / "versions" / version_id.strip()
    if not vd.is_dir() or not ((vd / "manifest.json").exists() or (vd / "iforest.joblib").exists()):
        raise ValueError(f"模型版本不存在或目录为空: {version_id}")
    row = get_or_create_system_config(db)
    row.active_model_version = version_id.strip()
    from datetime import datetime, timezone

    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    write_active_version_pointer(version_id.strip())
