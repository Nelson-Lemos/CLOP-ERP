from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.user import User, UserRole
from app.services import productivity_service as ps

router = APIRouter(prefix="/productivity", tags=["productivity"])


def _parse_period(start: datetime | None, end: datetime | None):
    if start and end and start > end:
        raise HTTPException(status_code=400, detail="Data inicial posterior à data final")
    return start, end


def _scoped_user(db: Session, current_user: User, user_id: int | None) -> User | None:
    if current_user.role == UserRole.CEO:
        if user_id is None:
            return None
        target = db.get(User, user_id)
        if target is None:
            raise HTTPException(status_code=404, detail="Funcionário não encontrado")
        return target
    if current_user.role == UserRole.MANAGER:
        target = db.get(User, user_id) if user_id is not None else current_user
        if target is None:
            raise HTTPException(status_code=404, detail="Funcionário não encontrado")
        if target.departamento_id != current_user.departamento_id:
            raise HTTPException(status_code=403, detail="Fora do seu departamento")
        return target
    if user_id is not None and user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso apenas à própria produtividade")
    return current_user


@router.get("/company")
def productivity_company(
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = None,
):
    if current_user.role != UserRole.CEO:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    start, end = _parse_period(start, end)
    return {
        "company": ps.compute_metrics(db, start=start, end=end),
        "departments": [
            {"id": d["id"], "nome": d["nome"], "completion_rate": d["completion_rate"], "overdue_tasks": d["overdue_tasks"], "total_tasks": d["total_tasks"]}
            for d in ps.department_breakdown(db)
        ],
        "monthly": ps.monthly_progression(db),
    }


@router.get("/departments")
def productivity_departments(
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = None,
):
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Acesso restrito")
    start, end = _parse_period(start, end)
    if current_user.role == UserRole.MANAGER:
        rows = [row for row in ps.department_breakdown(db) if row["id"] == current_user.departamento_id]
        return rows
    return ps.department_breakdown(db)


@router.get("/employees/{user_id}")
def productivity_employee(
    user_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = None,
):
    start, end = _parse_period(start, end)
    target = _scoped_user(db, current_user, user_id)
    return ps.compute_metrics(db, user_id=target.id, start=start, end=end)