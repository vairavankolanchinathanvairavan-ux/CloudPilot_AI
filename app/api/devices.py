import json
import re
import os
import hmac
import hashlib
import secrets

from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/devices", tags=["Remote Devices"])

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DEVICES_FILE = DATA_DIR / "remote_devices.jsonl"
ENROLLMENTS_FILE = DATA_DIR / "device_enrollments.json"
TOKENS_FILE = DATA_DIR / "device_tokens.json"

LOCK = Lock()


def now():
    return datetime.now(timezone.utc).isoformat()


def read_json_file(path):
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def write_json_file(path, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, indent=2), encoding="utf-8")
    temporary.replace(path)


def verify_dashboard_token(authorization: str = Header(default="")):
    expected = os.getenv("CLOUDPILOT_DASHBOARD_TOKEN")

    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Dashboard authentication is not configured"
        )

    if not hmac.compare_digest(authorization, f"Bearer {expected}"):
        raise HTTPException(status_code=401, detail="Invalid dashboard token")


def verify_device_token(authorization: str = Header(default="")):
    shared_token = os.getenv("CLOUDPILOT_TOKEN")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid device token")

    supplied = authorization[7:]

    # Backward compatibility for the existing trusted agent.
    if shared_token and hmac.compare_digest(supplied, shared_token):
        return None

    supplied_hash = hashlib.sha256(supplied.encode()).hexdigest()

    for record in read_json_file(TOKENS_FILE):
        if record.get("revoked"):
            continue

        stored_hash = record.get("token_hash", "")
        if stored_hash and hmac.compare_digest(supplied_hash, stored_hash):
            return record.get("device_id")

    raise HTTPException(status_code=401, detail="Invalid device token")


class DeviceMetrics(BaseModel):
    device_id: str = Field(min_length=3, max_length=80)
    device_name: str = Field(min_length=1, max_length=120)
    cpu_usage: float = Field(ge=0, le=100)
    memory_usage: float = Field(ge=0, le=100)
    disk_usage: float = Field(ge=0, le=100)


class EnrollmentRequest(BaseModel):
    device_name: str = Field(min_length=1, max_length=120)


def read_devices():
    if not DEVICES_FILE.exists():
        return []

    records = []
    for line in DEVICES_FILE.read_text(encoding="utf-8").splitlines():
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return records


@router.post("/enroll")
def enroll_device(request: EnrollmentRequest):
    device_name = request.device_name.strip()

    if not device_name:
        raise HTTPException(status_code=400, detail="Device name is required")

    request_id = secrets.token_urlsafe(18)
    device_id = "dev_" + secrets.token_urlsafe(9)

    record = {
        "request_id": request_id,
        "device_id": device_id,
        "device_name": device_name,
        "status": "pending",
        "requested_at": now()
    }

    with LOCK:
        requests = read_json_file(ENROLLMENTS_FILE)
        requests.append(record)
        write_json_file(ENROLLMENTS_FILE, requests)

    return {
        "status": "pending",
        "request_id": request_id,
        "message": "Registration submitted. Waiting for owner approval."
    }


@router.get("/enrollment/requests")
def list_enrollment_requests(authorization: str = Header(default="")):
    verify_dashboard_token(authorization)

    requests = read_json_file(ENROLLMENTS_FILE)

    return [
        {
            "request_id": item["request_id"],
            "device_id": item["device_id"],
            "device_name": item["device_name"],
            "status": item["status"],
            "requested_at": item["requested_at"]
        }
        for item in requests
        if item.get("status") == "pending"
    ]


@router.post("/enrollment/{request_id}/approve")
def approve_enrollment(
    request_id: str,
    authorization: str = Header(default="")
):
    verify_dashboard_token(authorization)

    with LOCK:
        requests = read_json_file(ENROLLMENTS_FILE)
        selected = next(
            (item for item in requests
             if item.get("request_id") == request_id),
            None
        )

        if not selected:
            raise HTTPException(status_code=404, detail="Request not found")

        if selected.get("status") != "pending":
            raise HTTPException(status_code=409, detail="Request already processed")

        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        tokens = read_json_file(TOKENS_FILE)
        tokens.append({
            "device_id": selected["device_id"],
            "token_hash": token_hash,
            "created_at": now(),
            "revoked": False
        })

        selected["status"] = "approved"
        selected["approved_at"] = now()

        write_json_file(TOKENS_FILE, tokens)
        write_json_file(ENROLLMENTS_FILE, requests)

    return {
        "status": "approved",
        "device_id": selected["device_id"],
        "device_name": selected["device_name"],
        "device_token": token,
        "message": "Save this token securely. It will not be shown again."
    }


@router.post("/enrollment/{request_id}/reject")
def reject_enrollment(
    request_id: str,
    authorization: str = Header(default="")
):
    verify_dashboard_token(authorization)

    with LOCK:
        requests = read_json_file(ENROLLMENTS_FILE)
        selected = next(
            (item for item in requests
             if item.get("request_id") == request_id),
            None
        )

        if not selected:
            raise HTTPException(status_code=404, detail="Request not found")

        if selected.get("status") != "pending":
            raise HTTPException(status_code=409, detail="Request already processed")

        selected["status"] = "rejected"
        selected["rejected_at"] = now()
        write_json_file(ENROLLMENTS_FILE, requests)

    return {"status": "rejected", "request_id": request_id}


@router.post("/metrics")
def receive_device_metrics(
    metrics: DeviceMetrics,
    authorization: str = Header(default="")
):
    authenticated_device_id = verify_device_token(authorization)

    if not re.fullmatch(r"[A-Za-z0-9_-]{3,80}", metrics.device_id):
        raise HTTPException(status_code=400, detail="Invalid device ID")

    if authenticated_device_id and authenticated_device_id != metrics.device_id:
        raise HTTPException(status_code=403, detail="Device ID does not match token")

    record = metrics.model_dump()
    record["timestamp"] = now()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with LOCK:
        with DEVICES_FILE.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record) + "\n")

    return {"status": "received", "device_id": metrics.device_id}


@router.get("")
def list_devices(authorization: str = Header(default="")):
    verify_dashboard_token(authorization)

    latest = {}
    for record in read_devices():
        latest[record["device_id"]] = record

    return list(latest.values())


@router.get("/{device_id}/history")
def device_history(
    device_id: str,
    authorization: str = Header(default="")
):
    verify_dashboard_token(authorization)

    return [
        record for record in read_devices()
        if record.get("device_id") == device_id
    ][-100:]
