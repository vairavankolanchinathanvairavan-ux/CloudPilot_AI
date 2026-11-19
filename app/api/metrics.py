from app.services.event_logger import log_event
from app.services.notification_manager import create_notification

from fastapi import APIRouter
from app.services.monitoring import get_system_metrics
from app.agents.monitor_agent import monitor_infrastructure
from app.schemas.metrics import SystemMetrics

router = APIRouter(prefix="/api/monitoring", tags=["Real Monitoring"])


@router.get("/system", response_model=SystemMetrics)
def system_metrics():
    return get_system_metrics()


@router.get("/agent")
def monitor_agent():
    return monitor_infrastructure()


# Real Mac System Historical Metrics

import json
from pathlib import Path

REAL_METRICS_FILE = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "real_system_metrics.jsonl"
)


def read_real_system_history():
    if not REAL_METRICS_FILE.exists():
        return []

    records = []
    for line in REAL_METRICS_FILE.read_text(encoding="utf-8").replace("\\n", "\n").splitlines():
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    return records


@router.get("/history")
def real_system_history():
    return read_real_system_history()[-100:]


@router.get("/history/summary")
def real_system_history_summary():
    records = read_real_system_history()

    fields = ["cpu_usage", "memory_usage", "disk_usage"]
    summary = {}

    for field in fields:
        values = [
            record[field]
            for record in records
            if isinstance(record.get(field), (int, float))
        ]

        summary[field] = {
            "average": round(sum(values) / len(values), 2) if values else None,
            "maximum": max(values) if values else None,
            "minimum": min(values) if values else None
        }

    summary["total_samples"] = len(records)
    return summary



# Real System Alert API

from app.services.monitoring import detect_system_alerts

@router.get("/alerts")
def real_system_alerts():
    records = read_real_system_history()

    if not records:
        return {
            "timestamp": None,
            "status": "unavailable",
            "total_alerts": 0,
            "alerts": []
        }

    latest = records[-1]
    alerts = detect_system_alerts(latest)

    return {
        "timestamp": latest["timestamp"],
        "status": "alert" if alerts else "healthy",
        "total_alerts": len(alerts),
        "alerts": alerts
    }


# Alert Simulation API - Demo Only

@router.get("/alerts/simulate")
def simulate_alerts(level: str = "warning"):

    scenarios = {
        "healthy": {
            "cpu_usage": 30,
            "memory_usage": 50,
            "disk_usage": 40
        },
        "warning": {
            "cpu_usage": 75,
            "memory_usage": 50,
            "disk_usage": 40
        },
        "critical": {
            "cpu_usage": 90,
            "memory_usage": 50,
            "disk_usage": 40
        },
        "multiple": {
            "cpu_usage": 90,
            "memory_usage": 95,
            "disk_usage": 95
        }
    }

    if level not in scenarios:
        return {
            "status": "error",
            "message": "Invalid level. Use healthy, warning, critical or multiple."
        }

    metrics = scenarios[level]
    alerts = detect_system_alerts(metrics)

    # Automatic notification for simulated alerts
    if alerts:
        notification_severity = (
            "critical" if level in ("critical", "multiple") else "warning"
        )

        create_notification(
            title=f"{notification_severity.upper()} Alert - {level.capitalize()} Scenario",
            message=f"{len(alerts)} alert(s) detected. Scenario: {level}. Metrics: {metrics}",
            severity=notification_severity
        )

    log_event({
        "type": "alert_simulation",
        "scenario": level,
        "status": "alert" if alerts else "healthy",
        "total_alerts": len(alerts),
        "simulated_metrics": metrics,
        "alerts": alerts
    })

    return {
        "simulation": True,
        "scenario": level,
        "status": "alert" if alerts else "healthy",
        "total_alerts": len(alerts),
        "simulated_metrics": metrics,
        "alerts": alerts
    }

from fastapi import HTTPException
from app.services.alert_manager import read_alert_statuses, update_alert_status

EVENTS_FILE = Path(__file__).resolve().parents[2] / "data" / "events.jsonl"


def read_alert_events():
    if not EVENTS_FILE.exists():
        return []

    records = []
    for line in EVENTS_FILE.read_text(encoding="utf-8").splitlines():
        try:
            event = json.loads(line)
            if event.get("type") == "alert_simulation":
                records.append(event)
        except json.JSONDecodeError:
            continue

    return records


@router.get("/alerts/history")
def managed_alert_history():
    events = read_alert_events()
    statuses = read_alert_statuses()

    for event in events:
        timestamp = event.get("timestamp")
        status_info = statuses.get(timestamp, {})
        event["management_status"] = status_info.get("status", "new")
        event["status_updated_at"] = status_info.get("updated_at")

    return list(reversed(events))


def change_alert_status(timestamp: str, new_status: str):
    events = read_alert_events()

    if not any(event.get("timestamp") == timestamp for event in events):
        raise HTTPException(status_code=404, detail="Alert event not found")

    result = update_alert_status(timestamp, new_status)

    log_event({
        "type": "alert_status_update",
        "alert_timestamp": timestamp,
        "management_status": new_status
    })

    return {
        "message": "Alert " + new_status + " successfully",
        "alert_timestamp": timestamp,
        **result
    }


@router.post("/alerts/acknowledge")
def acknowledge_alert(timestamp: str):
    return change_alert_status(timestamp, "acknowledged")


@router.post("/alerts/resolve")
def resolve_alert(timestamp: str):
    return change_alert_status(timestamp, "resolved")
