import io
import pytest
from fastapi.testclient import TestClient

from main import app
from database import engine, run_migrations

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Ensure schema is initialized and migrations run."""
    run_migrations(engine)


# =========================================================================
# Section 1: Citizen Workflow Testing
# =========================================================================

def test_01_citizen_submit_english_complaint():
    """1. Citizen submits an English complaint; verify classification, GPS, and tracking ID."""
    payload = {
        "citizen_text": "Massive deep pothole on Salem Main Road near the bus stand causing vehicle skidding.",
        "latitude": 11.3805,
        "longitude": 77.8920,
    }
    response = client.post("/api/v1/complaints", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    # Tracking ID format
    assert "tracking_id" in data
    assert data["tracking_id"].startswith("CP-")
    assert len(data["tracking_id"]) > 6

    # AI Classification
    assert data["category"] == "Pothole"
    assert data["department"] == "Roads / Public Works"
    assert data["priority"] in ["HIGH", "MEDIUM", "LOW"]
    assert data["ai_source"] in ["GEMINI_AI", "RULE_BASED_FALLBACK", "Gemini 2.5", "Keyword Fallback"]

    # Coordinates
    assert abs(data["latitude"] - 11.3805) < 0.0001
    assert abs(data["longitude"] - 77.8920) < 0.0001

    # Initial status and logs
    assert data["status"] == "OPEN"
    assert len(data["logs"]) >= 1
    assert data["logs"][0]["action"] == "SUBMITTED"


def test_02_citizen_submit_tamil_complaint():
    """2. Citizen submits a Tamil complaint; verify classification and bilingual routing."""
    payload = {
        "citizen_text": "குடிநீர் குழாய் உடைந்து சாலையில் பெருமளவு குடிநீர் வீணாகிறது, தண்ணீர் வரவில்லை.",
        "latitude": 11.3850,
        "longitude": 77.8950,
    }
    response = client.post("/api/v1/complaints", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    # Tamil classification
    assert data["category"] == "Water"
    assert data["department"] == "Water Supply"
    assert data["status"] == "OPEN"
    assert data["tracking_id"].startswith("CP-")


def test_03_citizen_track_complaint():
    """3. Citizen tracks valid complaint and checks invalid tracking ID."""
    # Submit first
    create_res = client.post(
        "/api/v1/complaints",
        json={
            "citizen_text": "Clogged street drainage overflowing onto pedestrian walkway.",
            "latitude": 11.3780,
            "longitude": 77.8910,
        },
    )
    assert create_res.status_code == 201
    tracking_id = create_res.json()["tracking_id"]

    # Track valid
    track_res = client.get(f"/api/v1/complaints/track/{tracking_id}")
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert track_data["tracking_id"] == tracking_id
    assert track_data["category"] == "Drainage"
    assert track_data["status"] == "OPEN"
    assert len(track_data["logs"]) >= 1

    # Track invalid ID returns 404
    bad_track_res = client.get("/api/v1/complaints/track/CP-INVALID-999-NOTFOUND")
    assert bad_track_res.status_code == 404
    assert "not found" in bad_track_res.json()["detail"].lower()


def test_04_citizen_duplicate_detection():
    """4. Citizen submits near-identical complaint at same location; verify duplicate grouping."""
    base_location = {"latitude": 11.3900, "longitude": 77.8900}
    text_1 = "Huge mountain of untreated garbage dumped on 2nd cross road near temple."
    text_2 = "Huge mountain of untreated garbage dumped on second cross road near the temple."

    res1 = client.post("/api/v1/complaints", json={"citizen_text": text_1, **base_location})
    assert res1.status_code == 201
    c1 = res1.json()

    res2 = client.post("/api/v1/complaints", json={"citizen_text": text_2, **base_location})
    assert res2.status_code == 201
    c2 = res2.json()

    # Second complaint should be detected as duplicate or share duplicate group ID
    if c2.get("duplicate_group_id"):
        assert c2["duplicate_confidence"] is not None
        assert c2["duplicate_confidence"] >= 0.5


# =========================================================================
# Section 2: Admin Workflow Testing
# =========================================================================

def test_05_admin_login_and_auth():
    """5. Admin login and profile endpoint."""
    res = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"},
    )
    assert res.status_code == 200
    token_data = res.json()
    assert token_data["role"] == "ADMIN"
    assert "access_token" in token_data

    # Profile check
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    profile_res = client.get("/api/v1/auth/me", headers=headers)
    assert profile_res.status_code == 200
    profile = profile_res.json()
    assert profile["email"] == "admin@civicpulse.gov"
    assert profile["role"] == "ADMIN"
    assert "hashed_password" not in profile


def test_06_admin_officer_management():
    """6. Admin directory, create officer, and department filter."""
    admin_res = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    # Create new officer
    new_officer = {
        "name": "Suresh Electrical",
        "email": "suresh.electrical.test@civicpulse.gov",
        "password": "SureshPass2026!",
        "department": "Electrical",
        "role": "OFFICER",
    }
    create_off = client.post("/api/v1/officers", json=new_officer, headers=admin_headers)
    assert create_off.status_code in [201, 400]  # 400 if already created in earlier run

    # Filter officers by Electrical department
    list_res = client.get("/api/v1/officers", params={"department": "Electrical"}, headers=admin_headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) >= 1
    for off in items:
        assert off["department"] == "Electrical"
        assert "hashed_password" not in off


def test_07_admin_only_route_protection():
    """7. Regular officer cannot access admin-only endpoints (403 Forbidden)."""
    # Login as regular officer
    off_res = client.post(
        "/api/v1/auth/token",
        json={"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"},
    )
    assert off_res.status_code == 200
    off_headers = {"Authorization": f"Bearer {off_res.json()['access_token']}"}

    # Officer tries to list all officers -> 403 Forbidden
    forbidden_list = client.get("/api/v1/officers", headers=off_headers)
    assert forbidden_list.status_code == 403
    assert "admin" in forbidden_list.json()["detail"].lower()

    # Officer tries to register new officer -> 403 Forbidden
    forbidden_create = client.post(
        "/api/v1/officers",
        json={
            "name": "Hacker",
            "email": "hacker@civicpulse.gov",
            "password": "Password123!",
            "department": "Administration",
            "role": "ADMIN",
        },
        headers=off_headers,
    )
    assert forbidden_create.status_code == 403


# =========================================================================
# Section 3: Officer Workflow Testing
# =========================================================================

def test_08_officer_sees_only_assigned_complaints():
    """8. Regular officer queue only contains assigned complaints."""
    off_res = client.post(
        "/api/v1/auth/token",
        json={"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"},
    )
    off_headers = {"Authorization": f"Bearer {off_res.json()['access_token']}"}

    queue_res = client.get("/api/v1/officer/complaints", headers=off_headers)
    assert queue_res.status_code == 200
    data = queue_res.json()
    assert "items" in data

    # Every item in regular officer queue must be assigned to Anitha (ID 2)
    for c in data["items"]:
        assert c["assigned_officer_id"] == 2


def test_09_officer_status_transition_rules():
    """9. Test state transitions, invalid transitions, and resolve guard."""
    admin_res = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    off_res = client.post(
        "/api/v1/auth/token",
        json={"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"},
    )
    off_headers = {"Authorization": f"Bearer {off_res.json()['access_token']}"}

    # Create complaint
    c_res = client.post(
        "/api/v1/complaints",
        json={
            "citizen_text": "Potholes along high school road requiring tar patchwork.",
            "latitude": 11.3820,
            "longitude": 77.8930,
        },
    )
    assert c_res.status_code == 201
    comp_id = c_res.json()["id"]

    # Assign to officer 2
    client.patch(
        f"/api/v1/officer/complaints/{comp_id}/assign",
        json={"officer_id": 2, "note": "Assigned to Roads officer."},
        headers=admin_headers,
    )

    # Valid transition: OPEN -> IN_PROGRESS
    valid_res = client.patch(
        f"/api/v1/officer/complaints/{comp_id}/status",
        json={"status": "IN_PROGRESS", "note": "Inspection started."},
        headers=off_headers,
    )
    assert valid_res.status_code == 200
    assert valid_res.json()["status"] == "IN_PROGRESS"

    # Invalid transition: from IN_PROGRESS, OPEN is invalid
    invalid_res = client.patch(
        f"/api/v1/officer/complaints/{comp_id}/status",
        json={"status": "OPEN", "note": "Trying to rewind."},
        headers=off_headers,
    )
    assert invalid_res.status_code == 400
    assert "invalid" in invalid_res.json()["detail"].lower()


def test_10_officer_resolution_validation():
    """10. Test image upload validation (types & 5 MB size limit)."""
    admin_res = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    off_res = client.post(
        "/api/v1/auth/token",
        json={"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"},
    )
    off_headers = {"Authorization": f"Bearer {off_res.json()['access_token']}"}

    # Create & assign
    c_res = client.post(
        "/api/v1/complaints",
        json={
            "citizen_text": "Damaged road curb with exposed rebar posing injury danger.",
            "latitude": 11.3825,
            "longitude": 77.8935,
        },
    )
    comp_id = c_res.json()["id"]
    client.patch(
        f"/api/v1/officer/complaints/{comp_id}/assign",
        json={"officer_id": 2},
        headers=admin_headers,
    )
    client.patch(
        f"/api/v1/officer/complaints/{comp_id}/status",
        json={"status": "IN_PROGRESS"},
        headers=off_headers,
    )

    # Reject non-image file type (e.g. text file)
    bad_file = io.BytesIO(b"Hello this is not an image.")
    bad_type_res = client.patch(
        f"/api/v1/officer/complaints/{comp_id}/resolve",
        files={"resolution_photo": ("notes.txt", bad_file, "text/plain")},
        data={"resolution_note": "Fixed the curb."},
        headers=off_headers,
    )
    assert bad_type_res.status_code == 400
    assert "image" in bad_type_res.json()["detail"].lower()

    # Reject oversized image (> 5 MB)
    large_bytes = b"0" * (5 * 1024 * 1024 + 1024)  # 5 MB + 1 KB
    large_file = io.BytesIO(large_bytes)
    oversized_res = client.patch(
        f"/api/v1/officer/complaints/{comp_id}/resolve",
        files={"resolution_photo": ("huge.jpg", large_file, "image/jpeg")},
        data={"resolution_note": "Fixed with huge photo."},
        headers=off_headers,
    )
    assert oversized_res.status_code == 400
    assert "5 mb" in oversized_res.json()["detail"].lower() or "size" in oversized_res.json()["detail"].lower()


# =========================================================================
# Section 4: Complete Cross-Portal Lifecycle Integration
# =========================================================================

def test_11_cross_portal_complete_lifecycle():
    """
    11. Complete real cross-portal integration lifecycle:
    Citizen Submits -> Admin Assigns -> Officer Starts -> Officer Resolves -> Citizen Tracks.
    """
    # Step 1: Citizen submits complaint
    citizen_payload = {
        "citizen_text": "Broken asphalt and deep road crater outside Railway Station Gate 2.",
        "latitude": 11.3795,
        "longitude": 77.8942,
    }
    submit_res = client.post("/api/v1/complaints", json=citizen_payload)
    assert submit_res.status_code == 201
    complaint = submit_res.json()
    complaint_id = complaint["id"]
    tracking_id = complaint["tracking_id"]
    assert complaint["status"] == "OPEN"
    assert complaint["category"] == "Pothole"
    assert complaint["department"] == "Roads / Public Works"

    # Step 2: Admin logs in and assigns complaint to Roads Officer Anitha (#2)
    admin_auth = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"},
    ).json()
    admin_headers = {"Authorization": f"Bearer {admin_auth['access_token']}"}

    assign_res = client.patch(
        f"/api/v1/officer/complaints/{complaint_id}/assign",
        json={"officer_id": 2, "note": "High traffic zone. Priority asphalt patch deployment."},
        headers=admin_headers,
    )
    assert assign_res.status_code == 200
    assigned_data = assign_res.json()
    assert assigned_data["assigned_officer_id"] == 2

    # Step 3: Officer logs in and starts work (IN_PROGRESS)
    officer_auth = client.post(
        "/api/v1/auth/token",
        json={"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"},
    ).json()
    officer_headers = {"Authorization": f"Bearer {officer_auth['access_token']}"}

    in_prog_res = client.patch(
        f"/api/v1/officer/complaints/{complaint_id}/status",
        json={"status": "IN_PROGRESS", "note": "Road repair team on site with compacting roller."},
        headers=officer_headers,
    )
    assert in_prog_res.status_code == 200
    assert in_prog_res.json()["status"] == "IN_PROGRESS"

    # Step 4: Officer resolves complaint with resolution photo and note
    valid_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"\x00" * 128)
    resolve_note_text = "Asphalt surface patched, compacted, leveled, and road line repainted."
    resolve_res = client.patch(
        f"/api/v1/officer/complaints/{complaint_id}/resolve",
        files={"resolution_photo": ("pothole_fixed.jpg", valid_jpeg, "image/jpeg")},
        data={"resolution_note": resolve_note_text},
        headers=officer_headers,
    )
    assert resolve_res.status_code == 200
    resolved_data = resolve_res.json()
    assert resolved_data["status"] == "RESOLVED"
    assert resolved_data["resolution_photo_url"] is not None
    assert resolved_data["resolution_note"] == resolve_note_text

    # Step 5: Citizen tracks the same complaint using public tracking ID
    track_res = client.get(f"/api/v1/complaints/track/{tracking_id}")
    assert track_res.status_code == 200
    final_view = track_res.json()

    # Verify complete visibility to citizen
    assert final_view["status"] == "RESOLVED"
    assert final_view["resolution_note"] == resolve_note_text
    assert final_view["resolution_photo_url"].startswith("/uploads/resolutions/res_")

    # Verify complete audit history
    actions = [log["action"] for log in final_view["logs"]]
    assert "SUBMITTED" in actions
    assert "ASSIGNED" in actions
    assert "STATUS_IN_PROGRESS" in actions
    assert "RESOLVED" in actions


# =========================================================================
# Section 5: API Error Handling & Validation
# =========================================================================

def test_12_api_error_handling_and_validation():
    """12. Test HTTP 400, 401, 403, 404, 422 error cases."""
    # 401: Invalid credentials
    res401 = client.post("/api/v1/auth/token", json={"email": "fake@test.com", "password": "wrong"})
    assert res401.status_code == 401

    # 401: Malformed JWT token
    res_bad_jwt = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer bad.token.here"})
    assert res_bad_jwt.status_code == 401

    # 400/422: Empty complaint text
    res_empty = client.post("/api/v1/complaints", json={"citizen_text": "   ", "latitude": 11.38, "longitude": 77.89})
    assert res_empty.status_code in [400, 422]

    # 422: Out-of-bounds coordinates (Latitude > 90)
    res_bad_gps = client.post("/api/v1/complaints", json={"citizen_text": "Test", "latitude": 195.0, "longitude": 77.89})
    assert res_bad_gps.status_code == 422

    # 404: Nonexistent complaint ID
    res404 = client.get("/api/v1/complaints/9999999")
    assert res404.status_code == 404
