from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.media_gateway import MediaGatewayError, prepare_camera_webrtc
from app.models import Camera, User
from app.schemas import CameraCreate, CameraOut, CameraUpdate, CameraWebRtcOut

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
    _: User = Depends(get_current_user),
) -> Camera:
    cam = Camera(
        name=body.name,
        rtsp_url=body.rtsp_url,
        location=body.location,
        risk_level=body.risk_level,
        is_active=body.is_active,
        notes=body.notes,
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam


@router.get("/active_streams", response_model=dict)
def active_streams(_: User = Depends(get_current_user)) -> dict:
    from services.streaming_service import active_stream_camera_ids

    return {"camera_ids": active_stream_camera_ids()}


@router.get("/{camera_id}", response_model=CameraOut)
def get_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Camera:
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if cam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return cam


@router.put("/{camera_id}", response_model=CameraOut)
def update_camera(
    camera_id: int,
    body: CameraUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Camera:
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if cam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(cam, key, value)
    db.commit()
    db.refresh(cam)
    return cam


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if cam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    db.delete(cam)
    db.commit()


@router.post("/{camera_id}/start", response_model=dict)
def start_stream(
    camera_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if cam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    from services.streaming_service import start_camera_stream

    started = start_camera_stream(camera_id)
    return {"camera_id": camera_id, "started": started}


@router.post("/{camera_id}/webrtc", response_model=CameraWebRtcOut)
def prepare_webrtc(
    camera_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CameraWebRtcOut:
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if cam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    if not cam.rtsp_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该摄像头未配置 RTSP 地址")

    try:
        info = prepare_camera_webrtc(camera_id, cam.rtsp_url)
    except MediaGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return CameraWebRtcOut(camera_id=camera_id, **info)


@router.post("/{camera_id}/stop", response_model=dict)
def stop_stream(
    camera_id: int,
    _: User = Depends(get_current_user),
) -> dict:
    from services.streaming_service import stop_camera_stream

    stop_camera_stream(camera_id)
    return {"camera_id": camera_id, "stopped": True}


