from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DepartmentStatus:
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["manager_id"], ["users.id"], name="fk_departments_manager", use_alter=True
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)
    manager_id: Mapped[int | None] = mapped_column(index=True)
    estado: Mapped[str] = mapped_column(String(20), default=DepartmentStatus.ACTIVE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    manager = relationship(
        "User",
        back_populates=None,
        foreign_keys=[manager_id],
        uselist=False,
    )
    funcionarios = relationship(
        "User", back_populates="departamento", foreign_keys="User.departamento_id"
    )
    tasks = relationship("Task", back_populates="department")