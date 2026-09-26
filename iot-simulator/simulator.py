"""Push simulated vitals into the WardZero API.

Usage:
  python simulator.py
  python simulator.py --scenario deteriorate
"""

import argparse
import json
import os
import time
import urllib.request

STEPS = {
    "steady": [
        {"hr": 82, "spo2": 97, "temp": 36.8, "systolic": 120, "diastolic": 80},
        {"hr": 84, "spo2": 97, "temp": 36.7, "systolic": 118, "diastolic": 78},
        {"hr": 80, "spo2": 98, "temp": 36.8, "systolic": 121, "diastolic": 80},
    ],
    "deteriorate": [
        {"hr": 82, "spo2": 97, "temp": 36.8, "systolic": 120, "diastolic": 80},
        {"hr": 91, "spo2": 95, "temp": 37.1, "systolic": 122, "diastolic": 80},
        {"hr": 101, "spo2": 92, "temp": 37.5, "systolic": 126, "diastolic": 82},
        {"hr": 108, "spo2": 89, "temp": 37.8, "systolic": 132, "diastolic": 86},
    ],
}


def post(url, payload, token):
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-device-token"] = token
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status


def device_token():
    if os.environ.get("DEVICE_INGEST_TOKEN"):
        return os.environ["DEVICE_INGEST_TOKEN"]
    env_path = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
    try:
        with open(env_path, encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("DEVICE_INGEST_TOKEN="):
                    return line.split("=", 1)[1].strip()
    except OSError:
        return ""
    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8080/api/ingest/readings")
    parser.add_argument("--token", default=device_token())
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--patient", default="rahul")
    parser.add_argument("--device", default="Pulse Oximeter")
    parser.add_argument("--scenario", choices=STEPS.keys(), default="steady")
    parser.add_argument("--interval", type=float, default=3)
    args = parser.parse_args()
    print(f"Streaming {args.scenario} to {args.url}")
    while True:
        for step in STEPS[args.scenario]:
            body = {**step, "patientId": args.patient, "deviceName": args.device, "source": "device"}
            try:
                status = post(args.url, body, args.token)
                print(status, body)
            except Exception as error:
                print("API unavailable:", error)
            time.sleep(args.interval)
            if args.once:
                return


if __name__ == "__main__":
    main()
