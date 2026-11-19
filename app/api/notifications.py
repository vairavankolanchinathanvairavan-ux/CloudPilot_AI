from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.notification_manager import (
    read_notifications,
    create_notification,
    mark_notification_read
)

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"]
)


class NotificationRequest(BaseModel):
    title: str
    message: str
    severity: str = "info"


@router.get("")
def get_notifications():
    notifications = read_notifications()
    return {
        "total": len(notifications),
        "unread": sum(not n["read"] for n in notifications),
        "notifications": list(reversed(notifications))
    }


@router.post("")
def add_notification(data: NotificationRequest):
    if data.severity not in ("info", "warning", "critical"):
        raise HTTPException(
            status_code=400,
            detail="Invalid notification severity"
        )

    return create_notification(
        data.title,
        data.message,
        data.severity
    )


@router.post("/{notification_id}/read")
def read_notification(notification_id: str):
    result = mark_notification_read(notification_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    return {
        "message": "Notification marked as read",
        "notification": result
    }
