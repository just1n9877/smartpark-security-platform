from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.auth_core import hash_password
from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import NotificationPreference, SecurityAuditLog, User
from app.schemas import (
    AdminUserCreate,
    AdminUserUpdate,
    NotificationPreferenceOut,
    NotificationPreferencePatch,
    SecurityAuditLogOut,
    UserPublic,
)

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _audit(db: Session, user_id: int | None, action: str, detail: str | None, request: Request) -> None:
    db.add(
        SecurityAuditLog(
            user_id=user_id,
            action=action,
            status="success",
            detail=detail,
            ip_address=_client_ip(request),
        )
    )
    db.commit()


def _notification_for(db: Session, user_id: int) -> NotificationPreference:
    row = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if row is None:
        row = NotificationPreference(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("", response_model=list[UserPublic])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[User]:
    return db.query(User).order_by(User.id.asc()).all()


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(
    body: AdminUserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> User:
    username = body.username.strip()
    email = body.email.strip().lower() if body.email else None
    if db.query(User).filter(User.username == username).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    if email and db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    row = User(
        username=username,
        email=email,
        hashed_password=hash_password(body.password),
        role=body.role,
        full_name=body.full_name,
        phone=body.phone,
        department=body.department,
        title=body.title,
        is_active=body.is_active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    db.add(NotificationPreference(user_id=row.id))
    db.commit()
    _audit(db, admin.id, "admin_create_user", f"user_id={row.id}", request)
    return row


@router.put("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    body: AdminUserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> User:
    row = db.query(User).filter(User.id == user_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    data = body.model_dump(exclude_unset=True)
    email = data.get("email")
    if email:
        email = str(email).strip().lower()
        exists = db.query(User).filter(User.email == email, User.id != user_id).first()
        if exists is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
        data["email"] = email
    password = data.pop("password", None)
    if row.id == admin.id and data.get("is_active") is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot disable current admin")
    if password:
        row.hashed_password = hash_password(password)
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    _audit(db, admin.id, "admin_update_user", f"user_id={row.id}", request)
    return row


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    row = db.query(User).filter(User.id == user_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if row.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot disable current admin")
    row.is_active = False
    db.commit()
    _audit(db, admin.id, "admin_disable_user", f"user_id={row.id}", request)


@router.get("/me/notifications", response_model=NotificationPreferenceOut)
def get_my_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationPreference:
    return _notification_for(db, user.id)


@router.patch("/me/notifications", response_model=NotificationPreferenceOut)
def patch_my_notifications(
    body: NotificationPreferencePatch,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationPreference:
    row = _notification_for(db, user.id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    _audit(db, user.id, "notification_update", None, request)
    return row


@router.get("/security-logs", response_model=list[SecurityAuditLogOut])
def security_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[SecurityAuditLog]:
    return db.query(SecurityAuditLog).order_by(SecurityAuditLog.created_at.desc()).limit(limit).all()
