from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DepartmentCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    descricao: str | None = None
    manager_id: int | None = None


class DepartmentUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    descricao: str | None = None
    manager_id: int | None = None
    estado: Literal["ACTIVE", "INACTIVE"] | None = None


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    descricao: str | None = None
    manager_id: int | None = None
    estado: str
    created_at: datetime
    updated_at: datetime


class DepartmentDetail(DepartmentOut):
    manager_nome: str | None = None
    manager_email: str | None = None
    employee_count: int = 0