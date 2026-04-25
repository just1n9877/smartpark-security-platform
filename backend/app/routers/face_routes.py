from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import FaceProfile, FaceRecognitionLog, Person, PersonAuthorization, TrackIdentity, User
from app.schemas import (
    FaceProfileOut,
    FaceRecognitionLogOut,
    PersonAuthorizationCreate,
    PersonAuthorizationOut,
    PersonCreate,
    PersonOut,
    PersonUpdate,
    TrackIdentityOut,
)
from services.face_recognition_service import embedding_from_file

router = APIRouter()


def _person_query(db: Session):
    return db.query(Person).options(
        selectinload(Person.face_profiles),
        selectinload(Person.authorizations),
    )


@router.get("/persons", response_model=list[PersonOut])
def list_persons(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Person]:
    return _person_query(db).order_by(Person.id.asc()).all()


@router.post("/persons", response_model=PersonOut, status_code=status.HTTP_201_CREATED)
def create_person(
    body: PersonCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Person:
    row = Person(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _person_query(db).filter(Person.id == row.id).first()


@router.put("/persons/{person_id}", response_model=PersonOut)
def update_person(
    person_id: int,
    body: PersonUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Person:
    row = db.query(Person).filter(Person.id == person_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    return _person_query(db).filter(Person.id == person_id).first()


@router.post("/persons/{person_id}/faces", response_model=FaceProfileOut, status_code=status.HTTP_201_CREATED)
async def upload_face(
    person_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FaceProfile:
    person = db.query(Person).filter(Person.id == person_id).first()
    if person is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    suffix = Path(file.filename or "face.jpg").suffix or ".jpg"
    rel = f"storage/faces/profiles/person{person_id}_{uuid4().hex}{suffix}"
    out_abs = settings.project_root.joinpath(*rel.split("/"))
    out_abs.parent.mkdir(parents=True, exist_ok=True)
    data = await file.read()
    out_abs.write_bytes(data)
    embedding, quality = embedding_from_file(out_abs)
    profile = FaceProfile(
        person_id=person_id,
        image_path=rel,
        embedding_json=embedding,
        quality_score=quality,
        is_active=True,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/authorizations", response_model=PersonAuthorizationOut, status_code=status.HTTP_201_CREATED)
def create_authorization(
    body: PersonAuthorizationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PersonAuthorization:
    if db.query(Person).filter(Person.id == body.person_id).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    row = PersonAuthorization(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/authorizations/{authorization_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_authorization(
    authorization_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    row = db.query(PersonAuthorization).filter(PersonAuthorization.id == authorization_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authorization not found")
    db.delete(row)
    db.commit()


@router.get("/recognition-logs", response_model=list[FaceRecognitionLogOut])
def list_recognition_logs(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[FaceRecognitionLog]:
    return db.query(FaceRecognitionLog).order_by(FaceRecognitionLog.created_at.desc()).limit(100).all()


@router.get("/track-identities", response_model=list[TrackIdentityOut])
def list_track_identities(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TrackIdentity]:
    return db.query(TrackIdentity).order_by(TrackIdentity.last_seen_at.desc()).limit(100).all()
