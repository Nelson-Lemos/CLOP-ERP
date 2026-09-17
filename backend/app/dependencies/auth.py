from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserStatus

bearer_scheme = HTTPBearer(auto_error=False)

INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Não autenticado",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise INVALID_CREDENTIALS

    payload = decode_token(credentials.credentials)
    subject = payload.get("sub")

    if not subject or payload.get("type") != "access":
        raise INVALID_CREDENTIALS

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise INVALID_CREDENTIALS

    user = db.get(User, user_id)
    if user is None or user.estado != UserStatus.ACTIVE:
        raise INVALID_CREDENTIALS

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]