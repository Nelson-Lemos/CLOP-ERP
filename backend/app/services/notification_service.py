from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType


def send_notification(
    db: Session,
    *,
    user_id: int,
    title: str,
    message: str,
    type: str,
) -> Notification:
    entry = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        is_read=False,
    )
    db.add(entry)
    return entry