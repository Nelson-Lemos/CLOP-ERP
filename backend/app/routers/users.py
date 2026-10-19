import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.dependencies.auth import CurrentUser
from app.dependencies.permissions import is_admin, require_admin
from app.models.department import Department
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserCreate, UserOut, UserStatusUpdate, UserUpdate
from app.services.audit_service import record_audit

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_PHOTO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
PHOTO_MIME_BY_EXTENSION = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
MAX_PHOTO_SIZE = 5 * 1024 * 1024


def _assert_manager_dept(current_user: User, target_user: User) -> None:
    if is_admin(current_user):
        return
    if current_user.role == UserRole.MANAGER and current_user.departamento_id == target_user.departamento_id:
        return
    if current_user.id == target_user.id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilizador não encontrado")
    return user


def _normalize_role(role: str) -> str:
    if role not in UserRole.all():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role inválido: {role}")
    return role


def _normalize_estado(estado: str) -> str:
    valid = {UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.SUSPENDED}
    if estado not in valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Estado inválido: {estado}")
    return estado


@router.get("", response_model=list[UserOut])
def list_users(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
    departamento_id: int | None = Query(default=None),
    estado: str | None = Query(default=None),
    role: str | None = Query(default=None),
) -> list[UserOut]:
    query = db.query(User)

    if current_user.role == UserRole.EMPLOYEE:
        return [UserOut.model_validate(current_user)]

    if current_user.role == UserRole.MANAGER:
        query = query.filter(User.departamento_id == current_user.departamento_id)

    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(User.nome_completo.ilike(pattern) | User.email.ilike(pattern))

    if departamento_id is not None:
        query = query.filter(User.departamento_id == departamento_id)

    if estado:
        query = query.filter(User.estado == _normalize_estado(estado))

    if role:
        query = query.filter(User.role == _normalize_role(role))

    return [UserOut.model_validate(u) for u in query.order_by(User.id).all()]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    email = payload.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já registado")

    if payload.departamento_id is not None:
        dept = db.get(Department, payload.departamento_id)
        if dept is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departamento não encontrado")

    user = User(
        nome_completo=payload.nome_completo.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        password_changed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        telefone=payload.telefone,
        cargo=payload.cargo,
        departamento_id=payload.departamento_id,
        role=payload.role,
        data_admissao=payload.data_admissao,
        foto=payload.foto or settings.DEFAULT_AVATAR,
        estado=UserStatus.ACTIVE,
    )
    db.add(user)
    db.flush()
    record_audit(db, user_id=current_user.id, action="CREATE_USER", entity="user", entity_id=user.id, request=request)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> UserOut:
    target = _get_user_or_404(db, user_id)
    if current_user.role == UserRole.EMPLOYEE and current_user.id != target.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")
    _assert_manager_dept(current_user, target)
    return UserOut.model_validate(target)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> UserOut:
    target = _get_user_or_404(db, user_id)
    data = payload.model_dump(exclude_unset=True)

    if data.get("password") is not None:
        if current_user.id == target.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use POST /api/auth/change-password para alterar a sua própria palavra-passe",
            )
        if not is_admin(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para redefinir a palavra-passe de outro utilizador",
            )

    if current_user.role in (UserRole.EMPLOYEE, UserRole.TRADING_LEADER):
        if current_user.id != target.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")
        if set(data) - {"telefone"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Funcionário só pode alterar o telefone",
            )
    elif current_user.role == UserRole.MANAGER:
        if current_user.id != target.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chefe não pode editar funcionários",
            )
        if set(data) - {"nome_completo", "email", "telefone", "cargo", "data_admissao"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chefe não pode alterar função, estado ou departamento",
            )
    else:
        _assert_manager_dept(current_user, target)

    if "email" in data:
        data["email"] = data["email"].lower().strip()
        conflict = (
            db.query(User)
            .filter(User.email == data["email"], User.id != target.id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já registado")

    if "departamento_id" in data and data["departamento_id"] is not None:
        dept = db.get(Department, data["departamento_id"])
        if dept is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departamento não encontrado")

    password_reset = data.pop("password", None) is not None
    if password_reset:
        data["password_hash"] = hash_password(payload.password or "")
        data["password_changed_at"] = datetime.now(timezone.utc).replace(tzinfo=None)

    for key, value in data.items():
        setattr(target, key, value)

    record_audit(
        db,
        user_id=current_user.id,
        action="CHANGE_PASSWORD" if password_reset else "UPDATE_USER",
        entity="user",
        entity_id=target.id,
        request=request,
    )
    db.commit()
    db.refresh(target)
    return UserOut.model_validate(target)


@router.patch("/{user_id}/status", response_model=UserOut)
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    target = _get_user_or_404(db, user_id)
    target.estado = payload.estado
    record_audit(db, user_id=current_user.id, action="UPDATE_USER", entity="user", entity_id=target.id, request=request)
    db.commit()
    db.refresh(target)
    return UserOut.model_validate(target)


@router.get("/{user_id}/photo")
def get_user_photo(
    user_id: int,
    db: Session = Depends(get_db),
) -> Response:
    target = db.get(User, user_id)
    if target is None or not target.foto_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fotografia não encontrada")
    return Response(
        content=target.foto_data,
        media_type=target.foto_mime or "image/jpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.post("/{user_id}/photo", response_model=UserOut)
async def upload_user_photo(
    user_id: int,
    request: Request,
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
) -> UserOut:
    target = _get_user_or_404(db, user_id)

    if current_user.id != target.id and not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")

    filename = file.filename or "fotografia"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_PHOTO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagem não permitido (PNG, JPG, JPEG, GIF, WEBP)",
        )

    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="A imagem não pode exceder 5 MB",
        )

    target.foto_data = content
    target.foto_mime = PHOTO_MIME_BY_EXTENSION.get(suffix, "image/jpeg")
    target.foto = f"/api/users/{target.id}/photo?v={time.time_ns()}"
    record_audit(db, user_id=current_user.id, action="UPDATE_USER", entity="user", entity_id=target.id, request=request)
    db.commit()
    db.refresh(target)
    return UserOut.model_validate(target)