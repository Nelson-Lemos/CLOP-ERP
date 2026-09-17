from datetime import datetime, timedelta, time

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User

PRIORITY_WEIGHTS = {
    TaskPriority.LOW: 1,
    TaskPriority.MEDIUM: 2,
    TaskPriority.HIGH: 3,
    TaskPriority.CRITICAL: 4,
}

ACTIVE_STATUSES = (TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED, TaskStatus.UNDER_REVIEW)


def _start_of_day(dt: datetime) -> datetime:
    return datetime.combine(dt.date(), time.min)


def _end_of_day(dt: datetime) -> datetime:
    return datetime.combine(dt.date(), time.max)


def _is_overdue(task: Task) -> bool:
    if task.deadline is None:
        return False
    if task.status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.OVERDUE):
        return False
    return task.deadline < datetime.now()


def _qualified_tasks(db: Session, *, user_id: int | None = None, department_id: int | None = None, start: datetime | None = None, end: datetime | None = None):
    query = db.query(Task)
    if user_id is not None:
        query = query.filter(Task.assigned_to == user_id)
    if department_id is not None:
        query = query.filter(Task.department_id == department_id)
    if start is not None:
        query = query.filter(Task.created_at >= start)
    if end is not None:
        query = query.filter(Task.created_at <= end)
    return query


def compute_metrics(db: Session, *, user_id: int | None = None, department_id: int | None = None, start: datetime | None = None, end: datetime | None = None) -> dict:
    tasks = _qualified_tasks(db, user_id=user_id, department_id=department_id, start=start, end=end).all()
    total = len(tasks)
    completed = [t for t in tasks if t.status == TaskStatus.COMPLETED]
    pending = [t for t in tasks if t.status in ACTIVE_STATUSES]
    overdue = [t for t in tasks if _is_overdue(t) or t.status == TaskStatus.OVERDUE]
    rejected = [t for t in tasks if t.status == TaskStatus.REJECTED]

    weighted_total = sum(PRIORITY_WEIGHTS.get(t.prioridade, 0) for t in tasks)
    weighted_done = sum(PRIORITY_WEIGHTS.get(t.prioridade, 0) for t in completed)

    on_time = 0
    for t in completed:
        if t.deadline is None:
            on_time += 1
        elif t.completed_at is not None and t.completed_at <= t.deadline:
            on_time += 1

    durations = [
        (t.completed_at - (t.start_date or t.created_at)).total_seconds() / 3600
        for t in completed
        if t.completed_at is not None
    ]

    return {
        "total_tasks": total,
        "completed_tasks": len(completed),
        "pending_tasks": len(pending),
        "overdue_tasks": len(overdue),
        "rejected_tasks": len(rejected),
        "completion_rate": round((len(completed) / total) * 100, 1) if total else 0.0,
        "on_time_rate": round((on_time / len(completed)) * 100, 1) if completed else 0.0,
        "average_completion_time": round(sum(durations) / len(durations), 2) if durations else 0.0,
        "weighted_score": round((weighted_done / weighted_total) * 100, 1) if weighted_total else 0.0,
    }


def employee_row(db: Session, user: User) -> dict:
    metrics = compute_metrics(db, user_id=user.id)
    return {
        "id": user.id,
        "nome": user.nome_completo,
        "email": user.email,
        "cargo": user.cargo,
        "departamento_id": user.departamento_id,
        "departamento_nome": user.departamento.nome if user.departamento else None,
        **metrics,
    }


def status_distribution(db: Session, *, user_id: int | None = None, department_id: int | None = None) -> dict:
    query = _qualified_tasks(db, user_id=user_id, department_id=department_id)
    rows = query.with_entities(Task.status, func.count(Task.id)).group_by(Task.status).all()
    return {status: count for status, count in rows}


def monthly_progression(db: Session, *, user_id: int | None = None, department_id: int | None = None, months: int = 12) -> list[dict]:
    query = db.query(Task).filter(Task.status == TaskStatus.COMPLETED, Task.completed_at.isnot(None))
    if user_id is not None:
        query = query.filter(Task.assigned_to == user_id)
    if department_id is not None:
        query = query.filter(Task.department_id == department_id)

    now = datetime.now()
    result = []
    for offset in range(months - 1, -1, -1):
        month_date = datetime(now.year, now.month, 1) - timedelta(days=offset * 31)
        month_date = datetime(month_date.year, month_date.month, 1)
        next_month = datetime(month_date.year + 1, 1, 1) if month_date.month == 12 else datetime(month_date.year, month_date.month + 1, 1)
        count = query.filter(Task.completed_at >= month_date, Task.completed_at < next_month).count()
        result.append({"month": month_date.month, "year": month_date.year, "label": MONTH_LABELS[month_date.month - 1], "count": count})
    return result


MONTH_LABELS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


def department_breakdown(db: Session) -> list[dict]:
    from app.models.department import Department

    rows = []
    for dept in db.query(Department).all():
        m = compute_metrics(db, department_id=dept.id)
        rows.append({"id": dept.id, "nome": dept.nome, **m})
    return rows