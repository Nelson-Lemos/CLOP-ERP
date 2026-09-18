from datetime import datetime

from sqlalchemy.orm import Session

from app.models.audit import AuditAction, AuditLog
from app.models.task import (
    Task,
    TaskHistory,
    TaskReview,
    TaskStatus,
    TaskUpdate,
)
from app.models.user import User, UserRole, UserStatus
from app.services.notification_service import send_notification


def _now() -> datetime:
    return datetime.now()


def is_task_overdue(task: Task) -> bool:
    if task.deadline is None:
        return False
    if task.status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.OVERDUE):
        return False
    return task.deadline < _now()


def mark_overdue_tasks(db: Session) -> int:
    cutoff = _now()
    tasks = (
        db.query(Task)
        .filter(
            Task.deadline.isnot(None),
            Task.deadline < cutoff,
            Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
        )
        .all()
    )
    for task in tasks:
        task.status = TaskStatus.OVERDUE
        _add_history(
            db,
            task=task,
            author=task.assigned_to,
            action="TASK_OVERDUE",
            description="Tarefa marcada automaticamente como atrasada",
        )
        if task.assigned_to:
            send_notification(
                db,
                user_id=task.assigned_to,
                title="Tarefa atrasada",
                message=f"A tarefa \"{task.titulo}\" excedeu o prazo.",
                type="TASK_OVERDUE",
            )
    if tasks:
        db.commit()
    return len(tasks)


def _add_history(db: Session, *, task: Task, author: int | None, action: str, description: str | None = None) -> TaskHistory:
    entry = TaskHistory(task_id=task.id, user_id=author, action=action, description=description)
    db.add(entry)
    db.flush()
    return entry


def _add_updates(db: Session, *, task: Task, author: int, progress: int, descricao: str | None) -> None:
    db.add(TaskUpdate(task_id=task.id, user_id=author, progress=progress, descricao=descricao))


def create_task(
    db: Session,
    *,
    actor: User,
    titulo: str,
    descricao: str | None,
    tipo: str,
    prioridade: str,
    assigned_to: int | None,
    department_id: int | None,
    start_date: datetime | None,
    deadline: datetime | None,
) -> Task:
    if assigned_to is not None:
        assignee = db.get(User, assigned_to)
        if assignee is None:
            raise ValueError("Funcionário atribuído não encontrado")
        if assignee.estado != UserStatus.ACTIVE:
            raise ValueError("Não é possível atribuir tarefas a um funcionário inativo")
        if actor.role == UserRole.MANAGER and assignee.departamento_id != actor.departamento_id:
            raise PermissionError("Chefe só pode atribuir tarefas dentro do seu departamento")

    task = Task(
        titulo=titulo,
        descricao=descricao,
        tipo=tipo,
        prioridade=prioridade,
        status=TaskStatus.PENDING,
        progress=0,
        created_by=actor.id,
        assigned_to=assigned_to,
        department_id=department_id,
        start_date=start_date,
        deadline=deadline,
    )
    db.add(task)
    db.flush()
    task_id = task.id

    if assigned_to:
        _add_history(db, task=task, author=actor.id, action="ASSIGN_TASK", description=f"Atribuída ao utilizador {assigned_to}")
        assignee_user = db.get(User, assigned_to)
        if assignee_user:
            send_notification(
                db,
                user_id=assigned_to,
                title="Nova tarefa atribuída",
                message=titulo,
                type="TASK_ASSIGNED",
            )

    _add_history(db, task=task, author=actor.id, action="CREATE_TASK", description="Tarefa criada")
    db.add(
        AuditLog(
            user_id=actor.id,
            action=AuditAction.CREATE_TASK,
            entity="task",
            entity_id=task_id,
        )
    )
    db.commit()
    db.refresh(task)
    return task


def update_task_by_actor(db: Session, *, actor: User, task: Task, changes: dict) -> Task:
    for key, value in changes.items():
        if key == "assigned_to" and value != task.assigned_to:
            if value is not None:
                new_assignee = db.get(User, value)
                if new_assignee is None:
                    raise ValueError("Funcionário atribuído não encontrado")
                if new_assignee.estado != UserStatus.ACTIVE:
                    raise ValueError("Não é possível atribuir tarefas a um funcionário inativo")
                if actor.role == UserRole.MANAGER and new_assignee.departamento_id != actor.departamento_id:
                    raise PermissionError("Chefe só pode atribuir tarefas dentro do seu departamento")
                _add_history(db, task=task, author=actor.id, action="ASSIGN_TASK", description=f"Atribuída ao utilizador {value}")
                send_notification(
                    db,
                    user_id=value,
                    title="Nova tarefa atribuída",
                    message=task.titulo,
                    type="TASK_ASSIGNED",
                )
            if task.status == TaskStatus.DECLINED:
                task.status = TaskStatus.PENDING
                _add_history(db, task=task, author=actor.id, action="UPDATE_TASK", description="Tarefa reaberta após reatribuição")
        setattr(task, key, value)
    _add_history(db, task=task, author=actor.id, action="UPDATE_TASK", description="Tarefa atualizada")
    db.add(
        AuditLog(
            user_id=actor.id,
            action=AuditAction.UPDATE_TASK,
            entity="task",
            entity_id=task.id,
        )
    )
    db.commit()
    db.refresh(task)
    return task


def set_progress(db: Session, *, actor: User, task: Task, progress: int, descricao: str | None) -> Task:
    now = _now()
    task.progress = progress
    if task.status == TaskStatus.PENDING:
        task.status = TaskStatus.IN_PROGRESS
    if progress == 100 and task.status not in (TaskStatus.COMPLETED, TaskStatus.CANCELLED):
        task.status = TaskStatus.SUBMITTED
        _add_history(db, task=task, author=actor.id, action="SUBMIT_TASK", description="Tarefa submetida")
    _add_updates(db, task=task, author=actor.id, progress=progress, descricao=descricao)
    _add_history(db, task=task, author=actor.id, action="UPDATE_TASK", description=f"Progresso atualizado para {progress}%")
    db.add(AuditLog(user_id=actor.id, action=AuditAction.UPDATE_TASK, entity="task", entity_id=task.id))
    db.commit()
    db.refresh(task)
    task.updated_at = now
    return task


def submit_task(db: Session, *, actor: User, task: Task, progress: int, descricao: str | None) -> Task:
    task.progress = progress
    task.status = TaskStatus.SUBMITTED
    _add_updates(db, task=task, author=actor.id, progress=progress, descricao=descricao)
    _add_history(db, task=task, author=actor.id, action="SUBMIT_TASK", description="Tarefa submetida para revisão")
    db.add(AuditLog(user_id=actor.id, action=AuditAction.SUBMIT_TASK, entity="task", entity_id=task.id))
    if task.created_by:
        send_notification(
            db,
            user_id=task.created_by,
            title="Tarefa submetida",
            message=f"\"{task.titulo}\" foi submetida para revisão.",
            type="TASK_SUBMITTED",
        )
    db.commit()
    db.refresh(task)
    return task


def approve_task(db: Session, *, reviewer: User, task: Task) -> Task:
    _require_reviewable(task)
    task.status = TaskStatus.COMPLETED
    task.progress = 100
    task.completed_at = _now()
    db.add(
        TaskReview(
            task_id=task.id,
            reviewed_by=reviewer.id,
            decision="APPROVED",
        )
    )
    _add_history(db, task=task, author=reviewer.id, action="APPROVE_TASK", description="Tarefa aprovada")
    db.add(AuditLog(user_id=reviewer.id, action=AuditAction.APPROVE_TASK, entity="task", entity_id=task.id))
    if task.assigned_to:
        send_notification(
            db,
            user_id=task.assigned_to,
            title="Tarefa aprovada",
            message=f"\"{task.titulo}\" foi aprovada.",
            type="TASK_APPROVED",
        )
    db.commit()
    db.refresh(task)
    return task


def reject_task(db: Session, *, reviewer: User, task: Task, motivo: str) -> Task:
    _require_reviewable(task)
    task.status = TaskStatus.REJECTED
    db.add(
        TaskReview(
            task_id=task.id,
            reviewed_by=reviewer.id,
            decision="REJECTED",
            motivo=motivo,
        )
    )
    _add_history(db, task=task, author=reviewer.id, action="REJECT_TASK", description=motivo)
    db.add(AuditLog(user_id=reviewer.id, action=AuditAction.REJECT_TASK, entity="task", entity_id=task.id))
    if task.assigned_to:
        send_notification(
            db,
            user_id=task.assigned_to,
            title="Tarefa rejeitada",
            message=f"\"{task.titulo}\" foi rejeitada. Motivo: {motivo}",
            type="TASK_REJECTED",
        )
    db.commit()
    db.refresh(task)
    return task


def _require_reviewable(task: Task) -> None:
    if task.status not in (TaskStatus.SUBMITTED, TaskStatus.UNDER_REVIEW):
        raise ValueError("Tarefa não está em revisão")


def can_review(actor: User, task: Task) -> bool:
    if actor.role == UserRole.CEO:
        return True
    if actor.role == UserRole.MANAGER:
        return actor.departamento_id == task.department_id
    return False


def can_manage(actor: User, task: Task) -> bool:
    if actor.role == UserRole.CEO:
        return True
    if actor.role == UserRole.MANAGER:
        return actor.departamento_id == task.department_id
    return False