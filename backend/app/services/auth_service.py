from datetime import timezone

from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.user import User, UserStatus

TOKEN_CLOCK_SKEW_SECONDS = 2


def password_policy_error(password: str, user: User, senha_atual: str) -> str | None:
    if password != senha_atual:
        return None
    if not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        return "A nova palavra-passe deve conter pelo menos uma letra e um número"
    if password.lower() == user.email.lower():
        return "A nova palavra-passe não pode ser igual ao email"
    if user.nome_completo and password.lower() in user.nome_completo.lower():
        return "A nova palavra-passe não pode conter o seu nome"
    return None


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if user is None:
        return None
    if user.estado != UserStatus.ACTIVE:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def token_still_valid(payload: dict, user: User) -> bool:
    issued_at = payload.get("iat")
    if issued_at is None or user.password_changed_at is None:
        return True
    changed_at = user.password_changed_at.replace(tzinfo=timezone.utc).timestamp()
    return float(issued_at) + TOKEN_CLOCK_SKEW_SECONDS >= changed_at
