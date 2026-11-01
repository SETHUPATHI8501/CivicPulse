import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

UVICORN_HOST = "127.0.0.1"


def _get_test_port(preferred: int = 8000) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((UVICORN_HOST, preferred))
            return preferred
        except OSError:
            s.bind((UVICORN_HOST, 0))
            return s.getsockname()[1]


UVICORN_PORT = _get_test_port(8000)
BASE_URL = f"http://{UVICORN_HOST}:{UVICORN_PORT}/api/v1"


def http_req(method, url, body_dict=None):
    data = json.dumps(body_dict).encode("utf-8") if body_dict else None
    headers = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return err.code, parsed


def test_citizen_workflow():
    print("=== Testing Citizen Workflow Integration with FastAPI Backend ===")

    python_exe = sys.executable
    port = _get_test_port(8000)
    base_url = f"http://{UVICORN_HOST}:{port}/api/v1"
    print(f"Starting backend server on {UVICORN_HOST}:{port}...")
    env = os.environ.copy()
    env["DISABLE_ONLINE_GEOCODING"] = "1"
    proc = subprocess.Popen(
        [python_exe, "-m", "uvicorn", "main:app", "--host", UVICORN_HOST, "--port", str(port)],
        cwd=str(backend_dir),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        # 1. Wait for server health
        started = False
        for _ in range(30):
            try:
                with urllib.request.urlopen(f"http://{UVICORN_HOST}:{port}/health") as r:
                    if r.status == 200:
                        started = True
                        break
            except Exception:
                time.sleep(0.3)

        assert started, "Backend failed to start!"
        print("1. Backend server healthy.")

        # 2. Test Form Validation: Empty text should fail 422
        code, err = http_req("POST", f"{base_url}/complaints", {"citizen_text": "   ", "latitude": 11.34, "longitude": 77.71})
        assert code == 422, f"Expected 422 for empty text, got {code}: {err}"
        print("2. Validation Check: Empty complaint text correctly rejected (HTTP 422).")

        # 3. Test Form Validation: Invalid coordinate should fail 422
        code, err = http_req("POST", f"{base_url}/complaints", {"citizen_text": "Pothole", "latitude": 95.0, "longitude": 77.71})
        assert code == 422, f"Expected 422 for latitude > 90, got {code}: {err}"
        print("3. Validation Check: Out-of-bounds latitude (95.0) correctly rejected (HTTP 422).")

        # 4. Test Valid Complaint Submission (Tamil & English description with voice transcript)
        payload = {
            "citizen_text": "சாலையில் மிகப்பெரிய பள்ளம் ஏற்பட்டுள்ளது வாகனங்கள் செல்ல இயலவில்லை! Pothole near government hospital.",
            "voice_transcript": "சாலையில் மிகப்பெரிய பள்ளம் உள்ளது",
            "latitude": 11.3412,
            "longitude": 77.7174,
        }
        code, res = http_req("POST", f"{base_url}/complaints", payload)
        assert code == 201, f"Complaint creation failed (HTTP {code}): {res}"
        tracking_id = res["tracking_id"]
        print(f"4. Complaint Submission Success (HTTP 201)!")
        print(f"   - Tracking ID: {tracking_id}")
        print(f"   - Classified Category: {res['category']}")
        print(f"   - Priority: {res['priority']}")
        print(f"   - Department: {res['department']}")
        print(f"   - Status: {res['status']}")
        print(f"   - AI Source: {res['ai_source']}")

        # 5. Test Track Complaint by newly created Tracking ID
        code, track_res = http_req("GET", f"{base_url}/complaints/track/{tracking_id}")
        assert code == 200, f"Tracking failed (HTTP {code}): {track_res}"
        assert track_res["tracking_id"] == tracking_id
        assert len(track_res["logs"]) >= 1, "Expected at least 1 initial log in track response"
        print(f"5. Real Tracking ID Verification Success (HTTP 200)!")
        print(f"   - Initial Audit Action: {track_res['logs'][0]['action']}")
        print(f"   - Logs Count: {len(track_res['logs'])}")

        # 6. Test Track Complaint for an existing RESOLVED issue (CP-B7C97719)
        code, resolved_res = http_req("GET", f"{base_url}/complaints/track/CP-B7C97719")
        if code == 200:
            print("6. Existing Resolved Complaint Verification:")
            print(f"   - Tracking ID: {resolved_res['tracking_id']}")
            print(f"   - Status: {resolved_res['status']}")
            print(f"   - Resolution Note: {resolved_res.get('resolution_note')}")
            print(f"   - Photo URL: {resolved_res.get('resolution_photo_url')}")
            print(f"   - Audit Logs: {len(resolved_res.get('logs', []))} entries")

        # 7. Test Non-Existent Tracking ID (404 Not Found)
        code, not_found_res = http_req("GET", f"{base_url}/complaints/track/CP-NOTFOUND99")
        assert code == 404, f"Expected 404 for missing tracking ID, got {code}: {not_found_res}"
        print(f"7. Invalid Tracking ID Check: Correctly returned HTTP 404 ({not_found_res.get('detail')}).")

        print("\n=== ALL CITIZEN API INTEGRATION TESTS PASSED 100%! ===")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        print("Backend server stopped.")


if __name__ == "__main__":
    test_citizen_workflow()
