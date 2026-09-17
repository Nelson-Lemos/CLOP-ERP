from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    titulo: str = Field(min_length=2, max_length=200)
    descricao: str | None = None
    tipo: Literal["DAILY", "WEEKLY", "MONTHLY", "NORMAL"] = "NORMAL"
    prioridade: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    assigned_to: int | None = None
    department_id: int | None = None
    start_date: datetime | None = None
    deadline: datetime | None = None


class TaskUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=2, max_length=200)
    descricao: str | None = None
    tipo: Literal["DAILY", "WEEKLY", "MONTHLY", "NORMAL"] | None = None
    prioridade: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = None
    assigned_to: int | None = None
    department_id: int | None = None
    start_date: datetime | None = None
    deadline: datetime | None = None


class TaskStatusUpdate(BaseModel):
    status: Literal[
        "PENDING",
        "IN_PROGRESS",
        "SUBMITTED",
        "UNDER_REVIEW",
        "COMPLETED",
        "REJECTED",
        "OVERDUE",
        "CANCELLED",
    ]


class TaskProgressUpdate(BaseModel):
    progress: int = Field(ge=0, le=100)
    descricao: str | None = None


class TaskSubmit(BaseModel):
    progress: int = Field(default=100, ge=0, le=100)
    descricao: str | None = None


class TaskReject(BaseModel):
    motivo: str = Field(min_length=3, max_length=1000)


class TaskReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    reviewed_by: int
    decision: str
    motivo: str | None = None
    created_at: datetime


class TaskUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int
    user_nome: str | None = None
    progress: int
    descricao: str | None = None
    created_at: datetime


class TaskHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int | None = None
    user_nome: str | None = None
    action: str
    description: str | None = None
    created_at: datetime


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descricao: str | None = None
    tipo: str
    prioridade: str
    status: str
    progress: int
    created_by: int
    assigned_to: int | None = None
    department_id: int | None = None
    start_date: datetime | None = None
    deadline: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TaskDetail(TaskOut):
    created_by_nome: str | None = None
    assigned_to_nome: str | None = None
    department_nome: str | None = None
    is_overdue: bool = False


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int
    filename: str
    content_type: str | None = None
    size: int | None = None
    created_at: datetime


def normalize_date(value: date | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.combine(value, time.min)