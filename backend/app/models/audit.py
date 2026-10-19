from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuditAction:
    LOGIN = "LOGIN"
    CREATE_USER = "CREATE_USER"
    UPDATE_USER = "UPDATE_USER"
    CHANGE_PASSWORD = "CHANGE_PASSWORD"
    CREATE_TASK = "CREATE_TASK"
    UPDATE_TASK = "UPDATE_TASK"
    DELETE_TASK = "DELETE_TASK"
    ASSIGN_TASK = "ASSIGN_TASK"
    SUBMIT_TASK = "SUBMIT_TASK"
    APPROVE_TASK = "APPROVE_TASK"
    REJECT_TASK = "REJECT_TASK"
    CREATE_DEPARTMENT = "CREATE_DEPARTMENT"
    UPDATE_DEPARTMENT = "UPDATE_DEPARTMENT"
    SAVE_CHECKLIST = "SAVE_CHECKLIST"
    CLOSE_CHECKLIST = "CLOSE_CHECKLIST"
    REOPEN_CHECKLIST = "REOPEN_CHECKLIST"
    CREATE_TRADE = "CREATE_TRADE"
    UPDATE_TRADE = "UPDATE_TRADE"
    DELETE_TRADE = "DELETE_TRADE"
    UPDATE_TRADING_ACCOUNT = "UPDATE_TRADING_ACCOUNT"
    UPDATE_TRADING_MONTH = "UPDATE_TRADING_MONTH"
    UPLOAD_TRADE_EVIDENCE = "UPLOAD_TRADE_EVIDENCE"
    REVIEW_TRADE = "REVIEW_TRADE"
    TRADE_REVIEW_RESPONSE = "TRADE_REVIEW_RESPONSE"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="audit_logs")