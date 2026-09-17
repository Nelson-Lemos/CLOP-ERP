from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.user import User, UserStatus


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if user is None:
        return None
    if user.estado != UserStatus.ACTIVE:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user