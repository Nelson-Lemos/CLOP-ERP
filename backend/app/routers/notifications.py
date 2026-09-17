from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(db: Session = Depends(get_db), current_user: CurrentUser = None):
    items = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in items
    ]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: CurrentUser = None):
    return {
        "unread": db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read.is_(False)).count()
    }


@router.patch("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), current_user: CurrentUser = None):
    item = db.get(Notification, notification_id)
    if item is None or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    item.is_read = True
    db.commit()
    db.refresh(item)
    return {"ok": True}


@router.patch("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: CurrentUser = None):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read.is_(False)).update({"is_read": True})
    db.commit()
    return {"ok": True}