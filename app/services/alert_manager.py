import json
from pathlib import Path
from datetime import datetime

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
STATUS_FILE = DATA_DIR / "alert_status.json"


def read_alert_statuses():
    if not STATUS_FILE.exists():
        return {}

    try:
        return json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def update_alert_status(timestamp, status):
    if status not in ("acknowledged", "resolved"):
        raise ValueError("Invalid alert status")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    statuses = read_alert_statuses()

    statuses[timestamp] = {
        "status": status,
        "updated_at": datetime.now().isoformat()
    }

    STATUS_FILE.write_text(
        json.dumps(statuses, indent=2),
        encoding="utf-8"
    )

    return statuses[timestamp]
