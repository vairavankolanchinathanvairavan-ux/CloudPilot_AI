from app.services.monitoring import get_system_metrics

def monitor_infrastructure():
    metrics = get_system_metrics()
    alerts = []

    if metrics["cpu_usage"] > 80:
        alerts.append("High CPU usage detected")

    if metrics["memory_usage"] > 80:
        alerts.append("High memory usage detected")

    if metrics["disk_usage"] > 85:
        alerts.append("High disk usage detected")

    return {
        "agent": "Monitor Agent",
        "metrics": metrics,
        "alerts": alerts,
        "status": "warning" if alerts else "healthy"
    }

