from app.agents.monitor_agent import monitor_infrastructure
from app.services.remediation import execute_remediation


def run_healing_agent():
    monitoring = monitor_infrastructure()

    healing = execute_remediation(
        monitoring["alerts"]
    )

    return {
        "agent": "Self-Healing Agent",
        "system_status": monitoring["status"],
        "alerts": monitoring["alerts"],
        "remediation": healing
    }
