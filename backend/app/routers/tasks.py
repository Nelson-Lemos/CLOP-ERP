from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.attachment import Attachment
from app.models.task import Task, TaskHistory, TaskStatus
from app.models.user import User, UserRole
from app.schemas.task import (
    AttachmentOut,
    TaskCreate,
    TaskDetail,
    TaskHistoryOut,
    TaskOut,
    TaskProgressUpdate,
    TaskReject,
    TaskStatusUpdate,
    TaskSubmit,
    TaskUpdate,
    TaskUpdateOut,
)
from app.services import task_service
from app.services.audit_service import record_audit
from app.services.notification_service import send_notification

router = APIRouter(prefix="/tasks", tags=["tasks"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
ALLOWED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".csv", ".txt", ".zip", ".ppt", ".pptx",
}
MAX_FILE_SIZE = 10 * 1024 * 1024


def _task_or_403(db: Session, actor: User, task_id: int) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarefa não encontrada")
    if task_service.can_manage(actor, task):
        return task
    if task.assigned_to == actor.id:
        return task
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")


def _to_detail(db: Session, task: Task) -> TaskDetail:
    return TaskDetail(
        id=task.id,
        titulo=task.titulo,
        descricao=task.descricao,
        tipo=task.tipo,
        prioridade=task.prioridade,
        status=task.status,
        progress=task.progress,
        created_by=task.created_by,
        assigned_to=task.assigned_to,
        department_id=task.department_id,
        start_date=task.start_date,
        deadline=task.deadline,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        created_by_nome=(task.creator.nome_completo if task.creator else None),
        assigned_to_nome=(task.employee.nome_completo if task.employee else None),
        assigned_to_foto=(task.employee.foto if task.employee else None),
        department_nome=(task.department.nome if task.department else None),
        is_overdue=task_service.is_task_overdue(task),
    )


@router.get("", response_model=list[TaskDetail])
def list_tasks(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    status_: str | None = Query(default=None, alias="status"),
    tipo: str | None = Query(default=None),
    prioridade: str | None = Query(default=None),
    department_id: int | None = Query(default=None),
    assigned_to: int | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[TaskDetail]:
    query = db.query(Task)

    if current_user.role == UserRole.EMPLOYEE:
        query = query.filter(Task.assigned_to == current_user.id)
    elif current_user.role == UserRole.MANAGER:
        query = query.filter(Task.department_id == current_user.departamento_id)

    if status_:
        query = query.filter(Task.status == status_)
    if tipo:
        query = query.filter(Task.tipo == tipo)
    if prioridade:
        query = query.filter(Task.prioridade == prioridade)
    if department_id:
        query = query.filter(Task.department_id == department_id)
    if assigned_to:
        query = query.filter(Task.assigned_to == assigned_to)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(Task.titulo.ilike(pattern) | Task.descricao.ilike(pattern))

    tasks = query.order_by(Task.created_at.desc()).limit(500).all()
    return [_to_detail(db, t) for t in tasks]


@router.post("", response_model=TaskDetail, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    request: Request,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetail:
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Funcionário não pode criar tarefas")

    try:
        task = task_service.create_task(
            db,
            actor=current_user,
            titulo=payload.titulo,
            descricao=payload.descricao,
            tipo=payload.tipo,
            prioridade=payload.prioridade,
            assigned_to=payload.assigned_to,
            department_id=payload.department_id,
            start_date=payload.start_date,
            deadline=payload.deadline,
        )
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    record_audit(db, user_id=current_user.id, action="CREATE_TASK", entity="task", entity_id=task.id, request=request)
    return _to_detail(db, task)


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(
    task_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetail:
    task = _task_or_403(db, current_user, task_id)
    return _to_detail(db, task)


@router.put("/{task_id}", response_model=TaskDetail)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    request: Request,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetail:
    task = _task_or_403(db, current_user, task_id)
    if not task_service.can_manage(current_user, task):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")

    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    try:
        task = task_service.update_task_by_actor(db, actor=current_user, task=task, changes=changes)
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    record_audit(db, user_id=current_user.id, action="UPDATE_TASK", entity="task", entity_id=task.id, request=request)
    return _to_detail(db, task)


@router.patch("/{task_id}/status", response_model=TaskDetail)
def update_task_status(
    task_id: int,
    payload: TaskStatusUpdate,
    request: Request,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetail:
    task = _task_or_403(db, current_user, task_id)
    new_status = payload.status

    if current_user.role == UserRole.EMPLOYEE:
        allowed = [TaskStatus.IN_PROGRESS]
        if new_status == TaskStatus.DECLINED:
            allowed = [TaskStatus.DECLINED]
        if new_status not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Funcionário não pode alterar este status")
        if new_status == TaskStatus.DECLINED:
            allowed_from = (TaskStatus.PENDING, TaskStatus.OVERDUE)
        else:
            allowed_from = (TaskStatus.PENDING, TaskStatus.OVERDUE, TaskStatus.REJECTED)
        if task.status not in allowed_from:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transição inválida")
        if task.assigned_to != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")
    else:
        if not task_service.can_manage(current_user, task):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")

    task.status = new_status
    if new_status == TaskStatus.COMPLETED:
        task.progress = 100
        task.completed_at = task_service._now()

    if new_status == TaskStatus.DECLINED:
        send_notification(
            db,
            user_id=task.created_by,
            title="Tarefa recusada",
            message=f"\"{task.titulo}\" foi recusada pelo funcionário atribuído.",
            type="TASK_DECLINED",
        )
        description = "Tarefa recusada pelo funcionário"
    else:
        description = f"Status alterado para {new_status}"

    db.add(
        TaskHistory(
            task_id=task.id,
            user_id=current_user.id,
            action="UPDATE_TASK",
            description=description,
        )
    )
    record_audit(db, user_id=current_user.id, action="UPDATE_TASK", entity="task", entity_id=task.id, request=request)
    db.commit()
    db.refresh(task)
    return _to_detail(db, task)


@router.patch("/{task_id}/progress", response_model=TaskDetail)
def update_progress(
    task_id: int,
    payload: TaskProgressUpdate,
    request: Request,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetail:
    task = _task_or_403(db, current_user, task_id)
    if current_user.role == UserRole.EMPLOYEE and task.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")
    if not task_service.can_manage(current_user, task) and task.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")

    task = task_service.set_progress(
        db,
        actor=current_user,
        task=task,
        progress=payload.progress,
        descricao=payload.descricao,
    )
    record_audit(db, user_id=current_user.id, action="UPDATE_TASK", entity="task", entity_id=task.id, request=request)
    return _to_detail(db, task)


@router.post("/{task_id}/submit", response_model=TaskDetail)
def submit_task(
    task_id: int,
    payload: TaskSubmit,
    request: Request,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetail:
    task = _task_or_403(db, current_user, task_id)
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Só o funcionário atribuído pode submeter")
    if task.status not in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE, TaskStatus.REJECTED):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tarefa não pode ser submetida")

    task = task_service.submit_task(db, actor=current_user, task=task, progress=payload.progress, descricao=payload.descricao)
    record_audit(db, user_id=current_user.id, action="SUBMIT_TASK", entity="task", entity_id=task.id, request=request)
    return _to_detail(db, task)


@router.post("/{task_id}/approve", response_model=TaskDetail)
def approve_task(
    task_id: int,
    request: Request,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetail:
    task = _task_or_403(db, current_user, task_id)
    if not task_service.can_review(current_user, task):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para rever")
    if task.assigned_to == current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Não pode aprovar a própria tarefa")

    try:
        task = task_service.approve_task(db, reviewer=current_user, task=task)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    record_audit(db, user_id=current_user.id, action="APPROVE_TASK", entity="task", entity_id=task.id, request=request)
    return _to_detail(db, task)


@router.post("/{task_id}/reject", response_model=TaskDetail)
def reject_task(
    task_id: int,
    payload: TaskReject,
    request: Request,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetail:
    task = _task_or_403(db, current_user, task_id)
    if not task_service.can_review(current_user, task):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para rever")
    if task.assigned_to == current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Não pode rejeitar a própria tarefa")

    try:
        task = task_service.reject_task(db, reviewer=current_user, task=task, motivo=payload.motivo)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    record_audit(db, user_id=current_user.id, action="REJECT_TASK", entity="task", entity_id=task.id, request=request)
    return _to_detail(db, task)


@router.get("/{task_id}/history", response_model=list[TaskHistoryOut])
def task_history(
    task_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[TaskHistoryOut]:
    task = _task_or_403(db, current_user, task_id)
    entries = sorted(task.history, key=lambda h: h.created_at)
    return [
        TaskHistoryOut(
            id=h.id,
            task_id=h.task_id,
            user_id=h.user_id,
            user_nome=(h.user.nome_completo if h.user else None),
            action=h.action,
            description=h.description,
            created_at=h.created_at,
        )
        for h in entries
    ]


@router.get("/{task_id}/updates", response_model=list[TaskUpdateOut])
def task_updates(
    task_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[TaskUpdateOut]:
    task = _task_or_403(db, current_user, task_id)
    return [
        TaskUpdateOut(
            id=u.id,
            task_id=u.task_id,
            user_id=u.user_id,
            user_nome=(u.user.nome_completo if u.user else None),
            progress=u.progress,
            descricao=u.descricao,
            created_at=u.created_at,
        )
        for u in sorted(task.updates, key=lambda x: x.created_at)
    ]


@router.post("/{task_id}/attachments", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    task_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
) -> AttachmentOut:
    task = _task_or_403(db, current_user, task_id)
    if task.assigned_to != current_user.id and not task_service.can_manage(current_user, task):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")

    filename = file.filename or "anexo"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Extensão de ficheiro não permitida")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Ficheiro demasiado grande")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"task_{task.id}_{filename}"
    path = UPLOAD_DIR / safe_name
    path.write_bytes(content)

    attachment = Attachment(
        task_id=task.id,
        user_id=current_user.id,
        filename=filename,
        file_path=str(path),
        content_type=file.content_type,
        size=len(content),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return AttachmentOut.model_validate(attachment)


@router.get("/{task_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(
    task_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[AttachmentOut]:
    task = _task_or_403(db, current_user, task_id)
    return [AttachmentOut.model_validate(a) for a in task.attachments]


@router.get("/{task_id}/attachments/{attachment_id}/download")
def download_attachment(
    task_id: int,
    attachment_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    from pathlib import Path as _Path

    from fastapi.responses import FileResponse

    task = _task_or_403(db, current_user, task_id)
    attachment = db.get(Attachment, attachment_id)
    if attachment is None or attachment.task_id != task.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anexo não encontrado")

    path = _Path(attachment.file_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ficheiro não encontrado")

    return FileResponse(
        path,
        media_type=attachment.content_type or "application/octet-stream",
        filename=attachment.filename,
        headers={"Content-Disposition": f'attachment; filename="{attachment.filename}"'},
    )