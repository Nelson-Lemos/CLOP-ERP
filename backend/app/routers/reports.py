from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.user import User, UserRole
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


def _scoped(db: Session, current_user: User, user_id: int | None = None, department_id: int | None = None):
    if current_user.role == UserRole.CEO:
        if user_id is not None:
            target = db.get(User, user_id)
            if target is None:
                raise HTTPException(status_code=404, detail="Funcionário não encontrado")
            return target, None
        if department_id is not None:
            return None, department_id
        return None, None

    if current_user.role == UserRole.MANAGER:
        if user_id is not None:
            target = db.get(User, user_id)
            if target is None:
                raise HTTPException(status_code=404, detail="Funcionário não encontrado")
            if target.departamento_id != current_user.departamento_id:
                raise HTTPException(status_code=403, detail="Fora do seu departamento")
            return target, None
        if department_id is not None and department_id != current_user.departamento_id:
            raise HTTPException(status_code=403, detail="Fora do seu departamento")
        return None, current_user.departamento_id

    if user_id is not None and user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso apenas à própria informação")
    return current_user, None


def _build(db, current_user, label, *, user_id=None, department_id=None, start=None, end=None):
    target, dept_id = _scoped(db, current_user, user_id, department_id)
    return report_service.build_report_data(
        db,
        user=target,
        department_id=dept_id,
        label=label,
        start=start,
        end=end,
    )


def _period(label: str):
    now = datetime.now()
    if label == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now, "Relatório diário"
    if label == "weekly":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now, "Relatório semanal"
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start, now, "Relatório mensal"


@router.get("/{period}")
def report_period(period: str, start: datetime | None = None, end: datetime | None = None, db: Session = Depends(get_db), current_user: CurrentUser = None):
    if period not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=404, detail="Período inválido")
    if start is None or end is None:
        start, end, label = _period(period)
    else:
        label = f"Relatório {period}"
    return _build(db, current_user, label, start=start, end=end)


@router.get("/employee/{user_id}")
def report_employee(user_id: int, start: datetime | None = None, end: datetime | None = None, db: Session = Depends(get_db), current_user: CurrentUser = None):
    return _build(db, current_user, "Relatório individual", user_id=user_id, start=start, end=end)


@router.get("/department/{department_id}")
def report_department(department_id: int, start: datetime | None = None, end: datetime | None = None, db: Session = Depends(get_db), current_user: CurrentUser = None):
    return _build(db, current_user, "Relatório departamental", department_id=department_id, start=start, end=end)


@router.get("/company")
def report_company(start: datetime | None = None, end: datetime | None = None, db: Session = Depends(get_db), current_user: CurrentUser = None):
    return _build(db, current_user, "Relatório geral da empresa", start=start, end=end)


def _pdf_response(data: dict, filename: str) -> Response:
    pdf = report_service.render_pdf(data)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/company/pdf")
def report_company_pdf(start: datetime | None = None, end: datetime | None = None, db: Session = Depends(get_db), current_user: CurrentUser = None):
    data = _build(db, current_user, "Relatório geral da empresa", start=start, end=end)
    return _pdf_response(data, "relatorio_empresa.pdf")


@router.get("/employee/{user_id}/pdf")
def report_employee_pdf(user_id: int, start: datetime | None = None, end: datetime | None = None, db: Session = Depends(get_db), current_user: CurrentUser = None):
    data = _build(db, current_user, "Relatório individual", user_id=user_id, start=start, end=end)
    return _pdf_response(data, f"relatorio_funcionario_{user_id}.pdf")


@router.get("/department/{department_id}/pdf")
def report_department_pdf(department_id: int, start: datetime | None = None, end: datetime | None = None, db: Session = Depends(get_db), current_user: CurrentUser = None):
    data = _build(db, current_user, "Relatório departamental", department_id=department_id, start=start, end=end)
    return _pdf_response(data, f"relatorio_departamento_{department_id}.pdf")