import io
import pytest
from fastapi.testclient import TestClient

from main import app
from database import engine, run_migrations

client = TestClient(app)


def test_officer_frontend_complete_lifecycle():
    # 0. Ensure database migrations
    run_migrations(engine)

    # 1. Admin Login
    admin_login_res = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"},
    )
    assert admin_login_res.status_code == 200, admin_login_res.text
    admin_token_data = admin_login_res.json()
    assert "access_token" in admin_token_data
    assert admin_token_data["role"] == "ADMIN"
    admin_headers = {"Authorization": f"Bearer {admin_token_data['access_token']}"}

    # 2. Admin /auth/me Profile
    admin_profile_res = client.get("/api/v1/auth/me", headers=admin_headers)
    assert admin_profile_res.status_code == 200
    admin_profile = admin_profile_res.json()
    assert admin_profile["email"] == "admin@civicpulse.gov"
    assert admin_profile["role"] == "ADMIN"

    # 3. Officer Login
    officer_login_res = client.post(
        "/api/v1/auth/token",
        json={"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"},
    )
    assert officer_login_res.status_code == 200
    officer_token_data = officer_login_res.json()
    assert officer_token_data["role"] == "OFFICER"
    assert officer_token_data["department"] == "Roads / Public Works"
    officer_headers = {"Authorization": f"Bearer {officer_token_data['access_token']}"}

    # 4. Invalid credentials check
    bad_login_res = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "WrongPassword999!"},
    )
    assert bad_login_res.status_code == 401

    # 5. Admin lists all complaints
    all_complaints_res = client.get("/api/v1/officer/complaints", headers=admin_headers)
    assert all_complaints_res.status_code == 200
    all_complaints = all_complaints_res.json()
    assert "items" in all_complaints
    assert "total" in all_complaints
    assert all_complaints["total"] >= 1

    # 6. Admin creates a new officer in Sanitation
    new_officer_payload = {
        "name": "Kavitha Sanitation",
        "email": "kavitha.sanitation.test@civicpulse.gov",
        "password": "SecurePassword2026!",
        "department": "Sanitation",
        "role": "OFFICER",
    }
    create_off_res = client.post("/api/v1/officers", json=new_officer_payload, headers=admin_headers)
    # May be 201 or 400 if already exists from prior test
    assert create_off_res.status_code in [201, 400]

    # 7. List officers with department filter
    sanitation_officers_res = client.get(
        "/api/v1/officers",
        params={"department": "Sanitation"},
        headers=admin_headers,
    )
    assert sanitation_officers_res.status_code == 200
    sanitation_list = sanitation_officers_res.json()
    assert sanitation_list["total"] >= 1

    # 8. Create a test complaint for status & resolution testing
    create_comp_res = client.post(
        "/api/v1/complaints",
        json={
            "citizen_text": "Massive deep pothole on West Main Street near signal creating dangerous traffic hazards.",
            "latitude": 11.3812,
            "longitude": 77.8924,
        },
    )
    assert create_comp_res.status_code == 201
    comp = create_comp_res.json()
    comp_id = comp["id"]
    assert comp["status"] == "OPEN"

    # 9. Admin assigns complaint to officer #2 (Anitha, Roads / Public Works)
    assign_res = client.patch(
        f"/api/v1/officer/complaints/{comp_id}/assign",
        json={"officer_id": 2, "note": "Assigned for immediate asphalt repaving."},
        headers=admin_headers,
    )
    assert assign_res.status_code == 200
    assigned_comp = assign_res.json()
    assert assigned_comp["assigned_officer_id"] == 2

    # 10. Officer transitions status OPEN -> IN_PROGRESS
    status_transition_res = client.patch(
        f"/api/v1/officer/complaints/{comp_id}/status",
        json={"status": "IN_PROGRESS", "note": "Road repair team dispatched with cold asphalt mix."},
        headers=officer_headers,
    )
    assert status_transition_res.status_code == 200
    in_prog_comp = status_transition_res.json()
    assert in_prog_comp["status"] == "IN_PROGRESS"

    # 11. Officer resolves complaint with resolution photo & note via multipart
    fake_photo = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00" + b"\x00" * 64)
    resolve_res = client.patch(
        f"/api/v1/officer/complaints/{comp_id}/resolve",
        files={"resolution_photo": ("road_resolved.jpg", fake_photo, "image/jpeg")},
        data={"resolution_note": "Pothole filled with cold asphalt mix, leveled, roller compacted, and lane reopened."},
        headers=officer_headers,
    )
    assert resolve_res.status_code == 200, resolve_res.text
    resolved_comp = resolve_res.json()
    assert resolved_comp["status"] == "RESOLVED"
    assert resolved_comp["resolution_photo_url"] is not None
    assert resolved_comp["resolution_photo_url"].startswith("/uploads/resolutions/res_")
    assert "Pothole filled" in resolved_comp["resolution_note"]

    # 12. Check complaint details contains updated logs
    get_details_res = client.get(f"/api/v1/complaints/{comp_id}")
    assert get_details_res.status_code == 200
    details = get_details_res.json()
    actions = [log["action"] for log in details["logs"]]
    assert "SUBMITTED" in actions
    assert "ASSIGNED" in actions
    assert "STATUS_IN_PROGRESS" in actions
    assert "RESOLVED" in actions
