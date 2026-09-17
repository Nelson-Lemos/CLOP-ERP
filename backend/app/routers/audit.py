from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.audit import AuditLog
from app.models.user import UserRole

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
def list_logs(
    action: str | None = None,
    entity: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: CurrentUser = None,
):
    if current_user.role != UserRole.CEO:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")

    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity:
        query = query.filter(AuditLog.entity == entity)

    total = query.count()
    items = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "username": log.user.email if log.user else None,
                "action": log.action,
                "entity": log.entity,
                "entity_id": log.entity_id,
                "ip_address": log.ip_address,
                "created_at": log.created_at,
            }
            for log in items
        ],
    }