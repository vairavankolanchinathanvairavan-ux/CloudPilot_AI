# Agentic CloudPilot AI — Final Year Project

Agentic CloudPilot AI is a final-year DevOps and Cloud project that combines multi-cloud monitoring, AI-assisted anomaly prediction, security checks, alert management, notifications and safe self-healing simulation in a web dashboard.

## What is included

- FastAPI backend
- Browser dashboard (HTML/CSS/JavaScript)
- Simulated AWS, Azure and Google Cloud provider cards
- Simulated CPU, memory, disk and latency metrics
- Transparent rule-based risk scoring and recommendations
- Allow-listed, human-approved **simulated** self-healing actions
- JSONL activity log
- Dockerfile and Docker Compose

> Important: this is a local demonstration MVP. It does **not** connect to real cloud accounts, run a trained ML model, or change real servers/Kubernetes. Provider cards and telemetry are simulated. Do not present this starter as production-ready.

## Requirements

- Python 3.10+
- macOS, Linux or Windows
- Optional: Docker Desktop

## Run locally (Mac/Linux)

From the project folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open these in your browser:

- Dashboard: `frontend/index.html` (open the file directly)
- API health: http://127.0.0.1:8000/api/health
- API docs: http://127.0.0.1:8000/docs

Keep the backend terminal running while using the dashboard.

## Run with Docker

```bash
docker compose up --build
```

Then open `frontend/index.html`. The API runs at http://127.0.0.1:8000.

## Test an analysis request

```bash
curl -X POST http://127.0.0.1:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"provider":"AWS-SIMULATED","service":"demo-web-server","cpu":92,"memory":94,"disk":60,"latency_ms":1500}'
```

## Test the safe self-healing flow

Without approval, the API refuses the action:

```bash
curl -X POST http://127.0.0.1:8000/api/heal \
  -H "Content-Type: application/json" \
  -d '{"action":"restart_demo_service","approved":false}'
```

Approved simulation:

```bash
curl -X POST http://127.0.0.1:8000/api/heal \
  -H "Content-Type: application/json" \
  -d '{"action":"restart_demo_service","approved":true}'
```

This only records a simulated action; no real service is restarted.

## Suggested development roadmap

1. Replace random metrics with Prometheus metrics from a local test environment.
2. Add a trained anomaly-detection model and evaluate it against labelled test data.
3. Integrate one cloud provider first using a dedicated least-privilege IAM role and read-only access.
4. Add Terraform plans and require human approval before applying infrastructure changes.
5. Add Kubernetes health checks and a controlled remediation service in a disposable test cluster.
6. Add Azure and GCP adapters after the first provider works reliably.
7. Add authentication, authorization, audit retention, secrets management, tests and deployment hardening.

## Security rules for future development

- Never commit cloud keys, passwords or `.env` files.
- Use least-privilege identities and short-lived credentials.
- Require human approval for destructive or cost-incurring actions.
- Keep an audit log and implement rollback.
- Test automation only in a disposable sandbox account/cluster.
- Restrict CORS and add authentication before exposing the API outside localhost.

## Main structure

```text
CloudPilot_AI/
├── app/
│   ├── __init__.py
│   └── main.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md
```
