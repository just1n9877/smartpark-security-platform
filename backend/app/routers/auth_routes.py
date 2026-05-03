from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth_core import authenticate_user, create_access_token, hash_password, verify_password
from app.database import get_db
from app.deps import get_current_user
from app.models import NotificationPreference, SecurityAuditLog, User, UserRole
from app.schemas import ChangePasswordRequest, LoginRequest, RegisterRequest, TokenResponse, UserProfileUpdate, UserPublic

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def write_audit(db: Session, user_id: int | None, action: str, status_: str, detail: str | None, ip: str | None) -> None:
    db.add(SecurityAuditLog(user_id=user_id, action=action, status=status_, detail=detail, ip_address=ip))
    db.commit()


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, body.username, body.password)
    if not user:
        write_audit(db, None, "login", "failed", body.username, _client_ip(request))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not getattr(user, "is_active", True):
        write_audit(db, user.id, "login", "failed", "disabled user", _client_ip(request))
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User disabled")
    token = create_access_token(str(user.id))
    write_audit(db, user.id, "login", "success", None, _client_ip(request))
    return TokenResponse(access_token=token)


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> User:
    username = body.username.strip()
    email = body.email.strip().lower()
    if db.query(User).filter(User.username == username).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(body.password),
        role=UserRole.guard,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(NotificationPreference(user_id=user.id))
    db.commit()
    return user


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.put("/me", response_model=UserPublic)
def update_me(
    body: UserProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    data = body.model_dump(exclude_unset=True)
    email = data.get("email")
    if email:
        email = str(email).strip().lower()
        exists = db.query(User).filter(User.email == email, User.id != user.id).first()
        if exists is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
        data["email"] = email
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    write_audit(db, user.id, "profile_update", "success", None, _client_ip(request))
    return user


@router.post("/change-password", response_model=dict)
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if not verify_password(body.current_password, user.hashed_password):
        write_audit(db, user.id, "change_password", "failed", "incorrect current password", _client_ip(request))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    write_audit(db, user.id, "change_password", "success", None, _client_ip(request))
    return {"message": "password updated"}
