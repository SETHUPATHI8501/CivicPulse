import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

UVICORN_HOST = "127.0.0.1"
UVICORN_PORT = 8000
BASE_URL = f"http://{UVICORN_HOST}:{UVICORN_PORT}"

# Real valid minimal JPEG bytes
MINIMAL_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
    b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
    b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
    b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
    b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
    b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
)


def http_request(method: str, url: str, headers: dict = None, data: bytes = None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
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


def encode_multipart_form(fields: dict, files: dict):
    boundary = f"----WebKitFormBoundary{os.urandom(16).hex()}"
    body = bytearray()

    for k, v in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
        body.extend(f"{v}\r\n".encode("utf-8"))

    for k, (filename, content, content_type) in files.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{k}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
        body.extend(content)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    return boundary, bytes(body)


def run_live_test():
    print("=== CivicPulse AI - Phase 5 Final Corrections Live Uvicorn Test ===")

    # 1. Start Uvicorn process
    python_exe = sys.executable
    print(f"Launching Uvicorn server on {BASE_URL}...")
    proc = subprocess.Popen(
        [python_exe, "-m", "uvicorn", "main:app", "--host", UVICORN_HOST, "--port", str(UVICORN_PORT)],
        cwd=str(backend_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        # Wait for server to become responsive
        started = False
        for _ in range(30):
            try:
                status, _ = http_request("GET", f"{BASE_URL}/health")
                if status == 200:
                    started = True
                    break
            except Exception:
                time.sleep(0.3)

        if not started:
            print("Error: Uvicorn server failed to start within timeout.")
            sys.exit(1)

        print("1. Server is healthy and running.")

        # 2. Login as Admin
        admin_login = json.dumps({"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"}).encode("utf-8")
        status, res = http_request("POST", f"{BASE_URL}/api/v1/auth/token", {"Content-Type": "application/json"}, admin_login)
        assert status == 200, f"Admin login failed: {res}"
        admin_token = res["access_token"]
        print(f"2. Admin authenticated. Token received (role: {res['role']}).")

        # 3. Login as Officer Anitha
        anitha_login = json.dumps({"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"}).encode("utf-8")
        status, res = http_request("POST", f"{BASE_URL}/api/v1/auth/token", {"Content-Type": "application/json"}, anitha_login)
        assert status == 200, f"Officer login failed: {res}"
        anitha_token = res["access_token"]
        print(f"3. Officer Anitha authenticated. Token received (dept: {res['department']}).")

        # 4. Submit a new citizen complaint
        new_complaint = json.dumps({
            "citizen_text": "Live test pothole complaint on Collectorate Road with sharp edges",
            "latitude": 11.3418,
            "longitude": 77.7176,
        }).encode("utf-8")
        status, c_res = http_request("POST", f"{BASE_URL}/api/v1/complaints", {"Content-Type": "application/json"}, new_complaint)
        assert status == 201, f"Complaint creation failed: {c_res}"
        complaint_id = c_res["id"]
        print(f"4. Complaint submitted. ID: {complaint_id}, Tracking ID: {c_res['tracking_id']}, Category: {c_res['category']}.")

        # 5. Assign to Officer Anitha (id: 2) as Admin
        assign_body = json.dumps({"officer_id": 2, "note": "Assigned to Zone 1 road engineer."}).encode("utf-8")
        status, assign_res = http_request(
            "PATCH",
            f"{BASE_URL}/api/v1/officer/complaints/{complaint_id}/assign",
            {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"},
            assign_body,
        )
        assert status == 200, f"Complaint assignment failed: {assign_res}"
        print(f"5. Complaint {complaint_id} assigned to Officer ID {assign_res['assigned_officer_id']}.")

        # 6. Officer sets status to IN_PROGRESS
        prog_body = json.dumps({"status": "IN_PROGRESS", "note": "Field crew arrived at location."}).encode("utf-8")
        status, prog_res = http_request(
            "PATCH",
            f"{BASE_URL}/api/v1/officer/complaints/{complaint_id}/status",
            {"Content-Type": "application/json", "Authorization": f"Bearer {anitha_token}"},
            prog_body,
        )
        assert status == 200, f"Status update failed: {prog_res}"
        print(f"6. Status changed to: {prog_res['status']}.")

        # 7. Verify status API rejects setting RESOLVED directly
        direct_res_body = json.dumps({"status": "RESOLVED", "note": "Trying direct resolution"}).encode("utf-8")
        status, rej_res = http_request(
            "PATCH",
            f"{BASE_URL}/api/v1/officer/complaints/{complaint_id}/status",
            {"Content-Type": "application/json", "Authorization": f"Bearer {anitha_token}"},
            direct_res_body,
        )
        assert status == 400, f"Expected 400 when setting RESOLVED directly, got: {status}"
        print(f"7. Direct RESOLVED attempt via /status correctly rejected (HTTP 400: {rej_res['detail']}).")

        # 8. Create temporary live test image file on disk
        test_img_path = backend_dir / "test_resolution_proof.jpg"
        test_img_path.write_bytes(MINIMAL_JPEG)
        print(f"8. Prepared test image file on disk: {test_img_path.name} ({len(MINIMAL_JPEG)} bytes).")

        # 9. Perform resolution upload with multipart form data
        boundary, body_bytes = encode_multipart_form(
            fields={"resolution_note": "Pothole filled with WMM base and bitumen cold-mix macadam, leveled and rolled."},
            files={"resolution_photo": (test_img_path.name, test_img_path.read_bytes(), "image/jpeg")},
        )
        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {anitha_token}",
        }
        status, resolve_res = http_request(
            "PATCH",
            f"{BASE_URL}/api/v1/officer/complaints/{complaint_id}/resolve",
            headers,
            body_bytes,
        )
        assert status == 200, f"Resolution upload failed (HTTP {status}): {resolve_res}"
        print(f"9. Live Resolution Endpoint Success (HTTP 200)!")
        print(f"   - Status: {resolve_res['status']}")
        print(f"   - Resolution Photo URL: {resolve_res['resolution_photo_url']}")
        print(f"   - Resolution Note: {resolve_res['resolution_note']}")

        # 10. Verify uploaded file actually exists on server filesystem
        photo_rel_path = resolve_res["resolution_photo_url"].lstrip("/")
        saved_file_path = backend_dir / photo_rel_path
        assert saved_file_path.exists(), f"Uploaded resolution file not found on disk: {saved_file_path}"
        assert saved_file_path.stat().st_size == len(MINIMAL_JPEG), "Uploaded file size mismatch on disk!"
        print(f"10. File persistence verified on disk: {saved_file_path} ({saved_file_path.stat().st_size} bytes).")

        # 11. Verify resolution audit log
        logs = resolve_res.get("logs", [])
        resolved_log = [l for l in logs if l["action"] == "RESOLVED"]
        assert len(resolved_log) >= 1, "RESOLVED audit log entry not found!"
        r_log = resolved_log[-1]
        print(f"11. Audit log verified:")
        print(f"   - Action: {r_log['action']}")
        print(f"   - Old Status: {r_log.get('old_status')}")
        print(f"   - New Status: {r_log.get('new_status')}")
        print(f"   - Officer ID: {r_log.get('officer_id')}")
        print(f"   - Actor Name: {r_log['actor_name']} ({r_log['actor_role']})")

        # Cleanup test image file on disk
        if test_img_path.exists():
            test_img_path.unlink()

        print("\n=== LIVE RESOLUTION ENDPOINT TEST COMPLETED SUCCESSFULLY! ===")

    finally:
        # Terminate Uvicorn server cleanly
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        print("Uvicorn test process terminated.")


if __name__ == "__main__":
    run_live_test()

