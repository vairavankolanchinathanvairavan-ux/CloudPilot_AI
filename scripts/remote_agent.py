import time
import json
import os
import urllib.request
import urllib.error
from pathlib import Path

import psutil
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SERVER = os.getenv("CLOUDPILOT_SERVER", "http://127.0.0.1:8000").rstrip("/")

CREDENTIALS_FILE = BASE_DIR / "data" / "approved_device_credentials.json"

if not CREDENTIALS_FILE.exists():
    raise RuntimeError("Approved device credentials file is missing")

credentials = json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))

TOKEN = credentials.get("device_token")
DEVICE_ID = credentials.get("device_id")
DEVICE_NAME = credentials.get("device_name")

if not TOKEN or not DEVICE_ID or not DEVICE_NAME:
    raise RuntimeError("Approved device credentials are incomplete")

print("CloudPilot Remote Agent Started")
print("Device:", DEVICE_NAME)
print("Device ID:", DEVICE_ID)
print("Using individual approved device token")

while True:
    try:
        cpu = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory().percent
        disk = psutil.disk_usage("/").percent

        payload = {
            "device_id": DEVICE_ID,
            "device_name": DEVICE_NAME,
            "cpu_usage": cpu,
            "memory_usage": memory,
            "disk_usage": disk
        }

        request = urllib.request.Request(
            SERVER + "/api/devices/metrics",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {TOKEN}"
            },
            method="POST"
        )

        with urllib.request.urlopen(request, timeout=10) as response:
            print(
                f"Sent | CPU {cpu}% | RAM {memory}% | "
                f"Disk {disk}% | HTTP {response.status}"
            )

    except urllib.error.HTTPError as error:
        print("HTTP Error:", error.code)
    except Exception as error:
        print("Connection Error:", error)

    time.sleep(9)
