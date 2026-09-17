from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.services import productivity_service as ps

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/admin")
def dashboard_admin(db: Session = Depends(get_db), current_user: CurrentUser = None):
    if current_user.role != UserRole.CEO:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")

    from app.models.department import Department

    today = datetime.now().date()
    today_tasks = [
        t for t in db.query(Task).all()
        if t.status != TaskStatus.CANCELLED
        and ((t.start_date and t.start_date.date() == today) or (t.deadline and t.deadline.date() == today))
    ]

    def statuses(items, statuses):
        return [t for t in items if t.status in statuses]

    employees = db.query(User).filter(User.role != UserRole.CEO).all()

    return {
        "total_employees": len(employees),
        "total_departments": db.query(Department).count(),
        "tasks_today": len(today_tasks),
        "completed_today": len(statuses(today_tasks, [TaskStatus.COMPLETED])),
        "pending_today": len(statuses(today_tasks, ps.ACTIVE_STATUSES)),
        "overdue_today": len([t for t in today_tasks if ps._is_overdue(t) or t.status == TaskStatus.OVERDUE]),
        "monthly": ps.monthly_progression(db),
        "departments": ps.department_breakdown(db),
        "status_distribution": ps.status_distribution(db),
        "employees": [ps.employee_row(db, u) for u in employees],
    }


@router.get("/department")
def dashboard_department(db: Session = Depends(get_db), current_user: CurrentUser = None):
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Acesso restrito a chefes e administradores")

    department_id = current_user.departamento_id
    if department_id is None:
        raise HTTPException(status_code=400, detail="Sem departamento associado")

    members = db.query(User).filter(User.departamento_id == department_id).order_by(User.nome_completo).all()
    metrics = ps.compute_metrics(db, department_id=department_id)
    dept_nome = members[0].departamento.nome if members and members[0].departamento else None

    return {
        "department_id": department_id,
        "department_nome": dept_nome,
        "total_employees": len(members),
        **metrics,
        "employees": [ps.employee_row(db, u) for u in members],
    }


@router.get("/employee")
def dashboard_employee(db: Session = Depends(get_db), current_user: CurrentUser = None):
    now = datetime.now()
    today = now.date()
    week_start = now - timedelta(days=now.weekday())
    month_start = now.replace(day=1)

    all_own = db.query(Task).filter(Task.assigned_to == current_user.id).all()

    def in_range(t: Task, start):
        refs = [d for d in (t.start_date, t.deadline, t.created_at) if d is not None]
        return any(d >= start for d in refs)

    today_tasks = [t for t in all_own if in_range(t, datetime.combine(today, datetime.min.time()))]
    week_tasks = [t for t in all_own if in_range(t, datetime.combine(week_start.date(), datetime.min.time()))]
    month_tasks = [t for t in all_own if in_range(t, datetime.combine(month_start.date(), datetime.min.time()))]

    def counts(items):
        return {
            "total": len(items),
            "completed": len([t for t in items if t.status == TaskStatus.COMPLETED]),
            "in_progress": len([t for t in items if t.status == TaskStatus.IN_PROGRESS]),
            "pending": len([t for t in items if t.status == TaskStatus.PENDING]),
            "submitted": len([t for t in items if t.status in (TaskStatus.SUBMITTED, TaskStatus.UNDER_REVIEW)]),
            "rejected": len([t for t in items if t.status == TaskStatus.REJECTED]),
            "overdue": len([t for t in items if ps._is_overdue(t) or t.status == TaskStatus.OVERDUE]),
        }

    return {
        "nome": current_user.nome_completo,
        "today": counts(today_tasks),
        "week": counts(week_tasks),
        "month": counts(month_tasks),
        "all": counts(all_own),
        "status_distribution": ps.status_distribution(db, user_id=current_user.id),
        "metrics": ps.compute_metrics(db, user_id=current_user.id),
    }