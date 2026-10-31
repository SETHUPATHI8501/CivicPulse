import io
import json
import sqlite3
from pathlib import Path
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def run_hackathon_demo():
    print("=" * 70)
    print("CIVICPULSE AI — HACKATHON LIVE DEMO WALKTHROUGH")
    print("Theme: Our Town, Reimagined • Team: Alronclad • Problem: ARSW001")
    print("=" * 70)

    # 1. Citizen reports a pothole in Tamil
    print("\n[STEP 1] Citizen files a civic grievance in Tamil via Citizen Portal (/report)...")
    tamil_complaint_text = (
        "[DEMO-HACKATHON] காவேரி நகர் மெயின் ரோட்டில் மிகப்பெரிய ஆபத்தான தார் சாலை பள்ளம் "
        "ஏற்பட்டுள்ளது. வாகனங்கள் விபத்துக்குள்ளாகும் அபாயம் உள்ளது."
    )
    submit_payload = {
        "citizen_text": tamil_complaint_text,
        "latitude": 11.3815,
        "longitude": 77.8925,
    }
    submit_res = client.post("/api/v1/complaints", json=submit_payload)
    assert submit_res.status_code == 201, submit_res.text
    complaint_data = submit_res.json()

    complaint_id = complaint_data["id"]
    tracking_id = complaint_data["tracking_id"]
    category = complaint_data["category"]
    department = complaint_data["department"]
    priority = complaint_data["priority"]
    status = complaint_data["status"]

    print(f"  -> Generated Tracking ID: {tracking_id}")
    print(f"  -> AI Category:           {category}")
    print(f"  -> Routed Department:     {department}")
    print(f"  -> Assessed Priority:     {priority}")
    print(f"  -> Initial Status:        {status}")

    # 2. Admin logs in and views officer directory
    print("\n[STEP 2] Municipal Administrator logs in to Operations Portal (/officer/login)...")
    admin_auth_res = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"},
    )
    assert admin_auth_res.status_code == 200
    admin_token = admin_auth_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("  -> Admin authenticated successfully (JWT Bearer Token issued)")

    # 3. Admin assigns complaint to Roads Officer Anitha (ID 2)
    print(f"\n[STEP 3] Administrator assigns {tracking_id} to Roads Officer Anitha (#2)...")
    assign_res = client.patch(
        f"/api/v1/officer/complaints/{complaint_id}/assign",
        json={
            "officer_id": 2,
            "note": "Urgent pothole on high-traffic Cauvery Nagar road. Dispatch ward road crew.",
        },
        headers=admin_headers,
    )
    assert assign_res.status_code == 200
    assigned_data = assign_res.json()
    print(f"  -> Successfully assigned to Officer #{assigned_data['assigned_officer_id']}")

    # 4. Officer Anitha logs in
    print("\n[STEP 4] Field Officer Anitha logs in (/officer/login)...")
    officer_auth_res = client.post(
        "/api/v1/auth/token",
        json={"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"},
    )
    assert officer_auth_res.status_code == 200
    officer_token = officer_auth_res.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_token}"}
    print("  -> Officer Anitha authenticated (Department: Roads / Public Works)")

    # 5. Officer starts work: status transition OPEN -> IN_PROGRESS
    print(f"\n[STEP 5] Officer transitions complaint {tracking_id} to IN_PROGRESS...")
    start_res = client.patch(
        f"/api/v1/officer/complaints/{complaint_id}/status",
        json={
            "status": "IN_PROGRESS",
            "note": "Road repair team on site with asphalt mixer and road roller.",
        },
        headers=officer_headers,
    )
    assert start_res.status_code == 200
    print(f"  -> New Status: {start_res.json()['status']}")

    # 6. Officer resolves complaint with resolution photo and note
    print(f"\n[STEP 6] Officer uploads proof-of-work photo and mandatory resolution summary...")
    fake_proof_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"\x00" * 256)
    resolution_note_text = (
        "Pothole excavated to solid base, filled with bituminous cold mix, "
        "compacted using vibratory roller, and reopened for public vehicles."
    )
    resolve_res = client.patch(
        f"/api/v1/officer/complaints/{complaint_id}/resolve",
        files={"resolution_photo": ("pothole_repaired_demo.jpg", fake_proof_jpeg, "image/jpeg")},
        data={"resolution_note": resolution_note_text},
        headers=officer_headers,
    )
    assert resolve_res.status_code == 200
    resolved_info = resolve_res.json()
    print(f"  -> Complaint Status:       {resolved_info['status']}")
    print(f"  -> Resolution Photo URL:   {resolved_info['resolution_photo_url']}")
    print(f"  -> Resolution Note:        {resolved_info['resolution_note']}")

    # 7. Citizen tracks the complaint using public tracking ID
    print(f"\n[STEP 7] Citizen tracks grievance at /track?id={tracking_id}...")
    track_res = client.get(f"/api/v1/complaints/track/{tracking_id}")
    assert track_res.status_code == 200
    track_info = track_res.json()

    print(f"  -> Citizen sees Status:    {track_info['status']}")
    print(f"  -> Resolution Verified:    {track_info['resolution_note']}")
    print(f"  -> Photo Proof Available:  {track_info['resolution_photo_url']}")
    print(f"  -> Audit Events Recorded:  {len(track_info['logs'])}")
    for idx, log in enumerate(track_info["logs"], 1):
        print(f"       [{idx}] {log['timestamp'][:19]} - {log['actor_role']}: {log['action']} ({log.get('note')})")

    print("\n" + "=" * 70)
    print("HACKATHON LIVE DEMO WORKFLOW VERIFICATION: 100% SUCCESS")
    print("=" * 70)


if __name__ == "__main__":
    run_hackathon_demo()

