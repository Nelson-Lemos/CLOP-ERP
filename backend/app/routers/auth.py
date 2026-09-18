from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.dependencies.auth import CurrentUser
from app.models.audit import AuditAction, AuditLog
from app.models.user import User, UserStatus
from app.schemas.auth import AuthResponse, LoginRequest, MeOut, RefreshRequest, TokenResponse
from app.schemas.user import UserOut
from app.services.auth_service import authenticate_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _me_out(user: User) -> MeOut:
    departamento = user.departamento
    return MeOut(
        **UserOut.model_validate(user).model_dump(),
        departamento_nome=departamento.nome if departamento else None,
        chefe_nome=departamento.manager.nome_completo if (departamento and departamento.manager) else None,
    )


def _login_audit(db: Session, user_id: int | None, request: Request) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=AuditAction.LOGIN,
            entity="auth",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    db.commit()


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    user = authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou password inválidos",
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    _login_audit(db, user.id, request)
    return AuthResponse(access_token=access_token, refresh_token=refresh_token, user=_me_out(user))


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    data = decode_token(payload.refresh_token)
    subject = data.get("sub")

    if not subject or data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado",
        )

    user = db.get(User, int(subject))
    if user is None or user.estado != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilizador não ativo",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=MeOut)
def me(current_user: CurrentUser) -> MeOut:
    return _me_out(current_user)