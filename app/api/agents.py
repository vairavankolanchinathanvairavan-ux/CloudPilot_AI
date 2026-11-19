from fastapi import APIRouter
from datetime import datetime, timezone
from app.agents.security_agent import scan_project
from app.agents.security_agent import scan_project
from app.agents.healing_agent import run_healing_agent
router = APIRouter(prefix="/api/agents", tags=["AI Agents"])


@router.get("/")
def get_agents():
    return {
        "agents": [
            {
                "name": "Monitor Agent",
                "status": "active",
                "role": "Infrastructure monitoring"
            },
            {
                "name": "Prediction Agent",
                "status": "active",
                "role": "Anomaly prediction"
            },
            {
                "name": "Security Agent",
                "status": "active",
                "role": "Security analysis"
            },
            {
                "name": "Healing Agent",
                "status": "active",
                "role": "Self-healing simulation"
            }
        ],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/status")
def agent_status():
    return {
        "system": "CloudPilot AI",
        "status": "operational",
        "agent_count": 4
    }
@router.get("/security")
def security_scan():
    return scan_project()
@router.get("/healing")
def healing_agent():
    return run_healing_agent()
