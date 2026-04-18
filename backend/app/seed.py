from sqlalchemy.orm import Session

from app.auth_core import hash_password
from app.models import User, UserRole


def seed_users_if_empty(db: Session) -> None:
    if db.query(User).first() is not None:
        return
    users = [
        User(username="admin", hashed_password=hash_password("admin123"), role=UserRole.admin),
        User(username="guard", hashed_password=hash_password("guard123"), role=UserRole.guard),
    ]
    db.add_all(users)
    db.commit()
