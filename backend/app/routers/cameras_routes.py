from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import Camera, User
from app.schemas import CameraCreate, CameraOut

router = APIRouter()


@router.get("", response_model=list[CameraOut])
def list_cameras(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Camera]:
    return db.query(Camera).order_by(Camera.id.asc()).all()


@router.post("", response_model=CameraOut)
def create_camera(
    body: CameraCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Camera:
    cam = Camera(name=body.name, rtsp_url=body.rtsp_url, notes=body.notes)
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam
