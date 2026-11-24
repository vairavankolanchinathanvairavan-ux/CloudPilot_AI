from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
from pathlib import Path
import json, random, statistics, os

async def automatic_system_monitor():
    from app.services.monitoring import get_system_metrics

    while True:
        try:
            await asyncio.to_thread(get_system_metrics)
        except Exception as error:
            print(f"Automatic system monitoring error: {error}")
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    monitor_task = asyncio.create_task(automatic_system_monitor())
    try:
        yield
    finally:
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="CloudPilot AI", version="1.0.0",
              description="Starter MVP: simulated multi-cloud monitoring, anomaly scoring and guarded self-healing.",
              lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(os.getenv("CLOUDPILOT_DATA_DIR", str(Path(__file__).resolve().parent.parent / "data"))).resolve()
DATA_DIR.mkdir(exist_ok=True)
EVENTS_FILE = DATA_DIR / "events.jsonl"

class Metric(BaseModel):
    provider: str = "AWS-SIMULATED"
    service: str = "demo-web-server"
    cpu: float
    memory: float
    disk: float
    latency_ms: float

class HealRequest(BaseModel):
    action: str
    approved: bool = False

def classify(m: Metric):
    # Transparent starter rules, not a trained ML model.
    risks = []
    if m.cpu >= 85: risks.append(("high_cpu", "CPU usage is critically high"))
    if m.memory >= 90: risks.append(("high_memory", "Memory usage is critically high"))
    if m.disk >= 90: risks.append(("high_disk", "Disk usage is critically high"))
    if m.latency_ms >= 1200: risks.append(("high_latency", "Application latency is high"))
    score = min(100, sum([30 if x[0] == "high_cpu" else 25 if x[0] == "high_memory" else 20 if x[0] == "high_disk" else 25 for x in risks]))
    status = "critical" if score >= 50 else "warning" if score else "healthy"
    recommendations = []
    if any(x[0] == "high_cpu" for x in risks):
        recommendations.append("Inspect CPU-heavy processes; consider scaling after checking traffic.")
    if any(x[0] == "high_memory" for x in risks):
        recommendations.append("Inspect memory leaks and memory limits.")
    if any(x[0] == "high_disk" for x in risks):
        recommendations.append("Check logs and storage growth; do not delete data automatically.")
    if any(x[0] == "high_latency" for x in risks):
        recommendations.append("Inspect application traces, dependencies and network latency.")
    return {"risk_score": score, "status": status, "signals": [x[1] for x in risks],
            "recommendations": recommendations}

def log_event(event):
    event["timestamp"] = datetime.now(timezone.utc).isoformat()
    with EVENTS_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")

@app.get("/")
def root():
    return {"name": "CloudPilot AI", "status": "running", "mode": "safe-simulation",
            "note": "This starter uses simulated infrastructure metrics and actions."}

@app.get("/api/health")
def health():
    return {"api": "online", "mode": "safe-simulation"}

@app.get("/api/providers")
def providers():
    return [
        {"name": "AWS", "connection": "simulated"},
        {"name": "Azure", "connection": "simulated"},
        {"name": "Google Cloud", "connection": "simulated"},
    ]

@app.get("/api/metrics")
def metrics():
    # Generate a fresh sample; occasional spikes demonstrate alerts.
    spike = random.random() < 0.22
    m = Metric(
        cpu=round(random.uniform(78, 98) if spike else random.uniform(18, 68), 1),
        memory=round(random.uniform(82, 96) if spike else random.uniform(30, 76), 1),
        disk=round(random.uniform(55, 94), 1),
        latency_ms=round(random.uniform(900, 1800) if spike else random.uniform(80, 450), 0),
    )
    result = m.model_dump()
    result.update(classify(m))
    log_event({"type": "metric_sample", **result})
    return result

@app.post("/api/analyze")
def analyze(metric: Metric):
    result = metric.model_dump()
    result.update(classify(metric))
    log_event({"type": "analysis", **result})
    return result

@app.post("/api/heal")
def heal(request: HealRequest):
    allowed = {"restart_demo_service", "scale_demo_replicas"}
    if request.action not in allowed:
        return {"success": False, "message": "Action is not on the allow-list."}
    if not request.approved:
        return {"success": False, "approval_required": True,
                "message": "Human approval is required before any remediation action."}
    # Safe demo only: no real server, cloud account, or Kubernetes cluster is changed.
    result = {"success": True, "action": request.action,
              "message": f"Simulated action '{request.action}' completed. No real infrastructure was changed."}
    log_event({"type": "self_heal_simulation", **result})
    return result

@app.get("/api/events")
def events():
    if not EVENTS_FILE.exists():
        return []
    lines = EVENTS_FILE.read_text(encoding="utf-8").splitlines()[-30:]
    output = []
    for line in reversed(lines):
        try: output.append(json.loads(line))
        except json.JSONDecodeError: pass
    return output




# Historical Metrics and AI Anomaly History

def read_metric_history():
    if not EVENTS_FILE.exists():
        return []

    records = []
    for line in EVENTS_FILE.read_text(encoding="utf-8").splitlines():
        try:
            event = json.loads(line)
            if event.get("type") == "metric_sample":
                records.append(event)
        except json.JSONDecodeError:
            continue

    return records


@app.get("/api/history/metrics")
def historical_metrics():
    records = read_metric_history()
    return records[-100:]


@app.get("/api/history/summary")
def historical_summary():
    records = read_metric_history()

    if not records:
        return {"total_samples": 0, "message": "No historical metrics available"}

    fields = ["cpu", "memory", "disk", "latency_ms"]
    summary = {}

    for field in fields:
        values = [r[field] for r in records if isinstance(r.get(field), (int, float))]
        summary[field] = {
            "average": round(sum(values) / len(values), 2) if values else None,
            "maximum": max(values) if values else None,
            "minimum": min(values) if values else None
        }

    summary["total_samples"] = len(records)
    return summary


@app.get("/api/history/anomalies")
def historical_anomalies():
    records = read_metric_history()
    anomalies = [
        r for r in records
        if r.get("status") in ("warning", "critical")
    ]
    return anomalies[-100:]

# CloudPilot AI Agent Routes
from app.api.agents import router as agents_router

app.include_router(agents_router)

# Real System Monitoring API
from app.api.metrics import router as monitoring_router
app.include_router(monitoring_router)

# AI Prediction API
from app.api.prediction import router as prediction_router
app.include_router(prediction_router)

from app.api.notifications import router as notifications_router
app.include_router(notifications_router)


# Remote Device Monitoring API
from app.api.devices import router as devices_router
app.include_router(devices_router)
