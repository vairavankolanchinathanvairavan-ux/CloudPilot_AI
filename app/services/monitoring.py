import json
import psutil
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
REAL_METRICS_FILE = DATA_DIR / "real_system_metrics.jsonl"


def get_system_metrics():
    metrics = {
        "timestamp": datetime.now().isoformat(),
        "cpu_usage": psutil.cpu_percent(interval=1),
        "memory_usage": psutil.virtual_memory().percent,
        "disk_usage": psutil.disk_usage("/").percent,
        "status": "active"
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with REAL_METRICS_FILE.open("a", encoding="utf-8") as file:
        file.write(json.dumps(metrics) + "\n")

    return metrics

# Real System Alert Thresholds
ALERT_THRESHOLDS = {
    "cpu_usage": {"warning": 70, "critical": 85},
    "memory_usage": {"warning": 80, "critical": 90},
    "disk_usage": {"warning": 80, "critical": 90},
}


def detect_system_alerts(metrics):
    alerts = []

    for metric, thresholds in ALERT_THRESHOLDS.items():
        value = metrics.get(metric, 0)

        if value >= thresholds["critical"]:
            alerts.append({
                "metric": metric,
                "value": value,
                "severity": "critical",
                "message": f"{metric} is critically high: {value}%"
            })
        elif value >= thresholds["warning"]:
            alerts.append({
                "metric": metric,
                "value": value,
                "severity": "warning",
                "message": f"{metric} is above warning threshold: {value}%"
            })

    return alerts

