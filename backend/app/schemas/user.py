from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome_completo: str
    email: str
    telefone: str | None = None
    cargo: str | None = None
    departamento_id: int | None = None
    role: str
    data_admissao: date | None = None
    foto: str | None = None
    estado: str
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    nome_completo: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    telefone: str | None = Field(default=None, max_length=30)
    cargo: str | None = Field(default=None, max_length=100)
    departamento_id: int | None = None
    role: Literal["CEO", "MANAGER", "EMPLOYEE"] = "EMPLOYEE"
    data_admissao: date | None = None
    foto: str | None = Field(default=None, max_length=255)


class UserUpdate(BaseModel):
    nome_completo: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    telefone: str | None = Field(default=None, max_length=30)
    cargo: str | None = Field(default=None, max_length=100)
    departamento_id: int | None = None
    role: Literal["CEO", "MANAGER", "EMPLOYEE"] | None = None
    data_admissao: date | None = None
    foto: str | None = Field(default=None, max_length=255)
    estado: Literal["ACTIVE", "INACTIVE", "SUSPENDED"] | None = None


class UserStatusUpdate(BaseModel):
    estado: Literal["ACTIVE", "INACTIVE", "SUSPENDED"]


class DepartmentRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str