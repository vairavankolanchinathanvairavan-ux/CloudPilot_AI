import json
from pathlib import Path
from datetime import datetime

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
NOTIFICATIONS_FILE = DATA_DIR / "notifications.json"


def read_notifications():
    if not NOTIFICATIONS_FILE.exists():
        return []

    try:
        return json.loads(
            NOTIFICATIONS_FILE.read_text(encoding="utf-8")
        )
    except (json.JSONDecodeError, OSError):
        return []


def create_notification(title, message, severity="info"):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    notifications = read_notifications()

    notification = {
        "id": datetime.now().strftime("%Y%m%d%H%M%S%f"),
        "title": title,
        "message": message,
        "severity": severity,
        "read": False,
        "created_at": datetime.now().isoformat()
    }

    notifications.append(notification)

    NOTIFICATIONS_FILE.write_text(
        json.dumps(notifications, indent=2),
        encoding="utf-8"
    )

    return notification


def mark_notification_read(notification_id):
    notifications = read_notifications()

    for notification in notifications:
        if notification["id"] == notification_id:
            notification["read"] = True
            NOTIFICATIONS_FILE.write_text(
                json.dumps(notifications, indent=2),
                encoding="utf-8"
            )
            return notification

    return None

def clear_notifications():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    NOTIFICATIONS_FILE.write_text("[]", encoding="utf-8")
    return {"message": "All notifications cleared", "total": 0}
