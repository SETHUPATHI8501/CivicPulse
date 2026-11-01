import io
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def get_admin_token() -> str:
    """Helper to login as admin and obtain JWT."""
    resp = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


def get_officer_token() -> str:
    """Helper to login as officer and obtain JWT."""
    resp = client.post(
        "/api/v1/auth/token",
        json={"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


class TestPhase2BackendExtensions:
    """Test suite covering Phase 2 backend extensions."""

    def test_01_public_stats_endpoint(self):
        """Verify GET /api/v1/complaints/public-stats returns accurate aggregate metrics."""
        response = client.get("/api/v1/complaints/public-stats")
        assert response.status_code == 200
        data = response.json()

        assert "total_complaints" in data
        assert "open_complaints" in data
        assert "in_progress_complaints" in data
        assert "resolved_complaints" in data
        assert "high_priority_complaints" in data
        assert "resolution_rate_pct" in data
        assert "category_distribution" in data

        assert isinstance(data["total_complaints"], int)
        assert isinstance(data["resolution_rate_pct"], (int, float))
        assert data["total_complaints"] >= 0
        assert isinstance(data["category_distribution"], dict)

        accounted = data["open_complaints"] + data["in_progress_complaints"] + data["resolved_complaints"]
        assert accounted <= data["total_complaints"]

    def test_02_json_complaint_creation_backward_compatibility(self):
        """Verify existing JSON POST /api/v1/complaints remains 100% backward compatible."""
        payload = {
            "citizen_text": "Broken asphalt on Cross Cut Road causing traffic congestion",
            "voice_transcript": None,
            "latitude": 11.0168,
            "longitude": 76.9558,
        }
        response = client.post("/api/v1/complaints", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["tracking_id"].startswith("CP-")
        assert data["category"] == "Pothole"
        assert data["status"] == "OPEN"
        assert data["photo_url"] is None

    def test_03_multipart_complaint_creation_with_photo(self):
        """Verify POST /api/v1/complaints/with-photo accepts multipart data and stores photo."""
        fake_image_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"\x00" * 100
        files = {
            "photo": ("pothole_evidence.jpg", io.BytesIO(fake_image_bytes), "image/jpeg"),
        }
        data = {
            "citizen_text": "Massive deep water pipeline burst flooding Bharathiar Road",
            "latitude": "11.0200",
            "longitude": "76.9600",
            "voice_transcript": "குடிநீர் குழாய் உடைந்து தண்ணீர் வீணாகிறது",
        }
        response = client.post("/api/v1/complaints/with-photo", data=data, files=files)
        assert response.status_code == 201
        res = response.json()
        assert res["tracking_id"].startswith("CP-")
        assert res["category"] == "Water"
        assert res["photo_url"] is not None
        assert res["photo_url"].startswith("/uploads/complaints/comp_")
        assert res["photo_url"].endswith(".jpg")

    def test_04_multipart_complaint_creation_without_photo(self):
        """Verify POST /api/v1/complaints/with-photo functions properly when photo is omitted."""
        data = {
            "citizen_text": "Streetlight bulb flickering and unlit for 3 weeks on Gandhi Street",
            "latitude": "11.0250",
            "longitude": "76.9650",
        }
        response = client.post("/api/v1/complaints/with-photo", data=data)
        assert response.status_code == 201
        res = response.json()
        assert res["tracking_id"].startswith("CP-")
        assert res["category"] == "Streetlight"
        assert res["photo_url"] is None

    def test_05_multipart_complaint_rejects_invalid_extension(self):
        """Verify citizen photo upload rejects non-image executable file types."""
        files = {
            "photo": ("malicious_script.exe", io.BytesIO(b"MZBINARY"), "application/octet-stream"),
        }
        data = {
            "citizen_text": "Illegal trash dumping near market area",
            "latitude": "11.0300",
            "longitude": "76.9700",
        }
        response = client.post("/api/v1/complaints/with-photo", data=data, files=files)
        assert response.status_code == 400
        assert "Invalid image extension" in response.json()["detail"]

    def test_06_multipart_complaint_rejects_oversized_file(self):
        """Verify citizen photo upload rejects images exceeding 5 MB limit."""
        oversized_bytes = b"\xFF\xD8\xFF\xE0" + b"\x00" * (5 * 1024 * 1024 + 1024)
        files = {
            "photo": ("giant_image.jpg", io.BytesIO(oversized_bytes), "image/jpeg"),
        }
        data = {
            "citizen_text": "Drainage overflow outside shopping complex",
            "latitude": "11.0350",
            "longitude": "76.9750",
        }
        response = client.post("/api/v1/complaints/with-photo", data=data, files=files)
        assert response.status_code == 400
        assert "exceeds maximum allowed size" in response.json()["detail"]

    def test_07_analytics_endpoints_require_authentication(self):
        """Verify analytics endpoints are protected by officer/admin authentication."""
        resp1 = client.get("/api/v1/analytics/summary")
        assert resp1.status_code == 401

        resp2 = client.get("/api/v1/analytics/hotspots")
        assert resp2.status_code == 401

        resp3 = client.get("/api/v1/analytics/complaint-density")
        assert resp3.status_code == 401

    def test_08_analytics_summary_with_admin_auth(self):
        """Verify GET /api/v1/analytics/summary returns KPI metrics when authenticated."""
        token = get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/analytics/summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_hotspots" in data
        assert "high_priority_hotspots" in data
        assert "top_affected_category" in data
        assert "grid_size_meters" in data
        assert data["grid_size_meters"] == 500.0

    def test_09_analytics_hotspots_list(self):
        """Verify GET /api/v1/analytics/hotspots returns ranked cluster cells."""
        token = get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/analytics/hotspots?grid_size=500", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "hotspots" in data
        assert "total_hotspots" in data
        assert isinstance(data["hotspots"], list)
        if len(data["hotspots"]) > 0:
            first = data["hotspots"][0]
            assert "cell_id" in first
            assert "complaint_count" in first
            assert "dominant_category" in first
            assert "intensity" in first
            assert "bounds" in first
            assert "center" in first

    def test_10_analytics_complaint_density_points(self):
        """Verify GET /api/v1/analytics/complaint-density returns map overlay coordinates."""
        token = get_officer_token()
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/analytics/complaint-density", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "points" in data
        assert "total_points" in data
        assert isinstance(data["points"], list)

    def test_11_cors_headers_development(self):
        """Verify CORS headers respond for allowed development origins."""
        response = client.options(
            "/api/v1/complaints/public-stats",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers

    def test_12_analytics_mobile_and_web_schema_compatibility(self):
        """Verify analytics endpoints provide both web and mobile expected field aliases."""
        token = get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}

        sum_resp = client.get("/api/v1/analytics/summary?grid_size=500", headers=headers)
        assert sum_resp.status_code == 200
        sum_data = sum_resp.json()
        assert "high_intensity_count" in sum_data
        assert "most_affected_category" in sum_data
        assert "total_complaints_in_hotspots" in sum_data

        hot_resp = client.get("/api/v1/analytics/hotspots?grid_size=500", headers=headers)
        assert hot_resp.status_code == 200
        hot_data = hot_resp.json()
        if hot_data["hotspots"]:
            spot = hot_data["hotspots"][0]
            assert "cluster_id" in spot
            assert "center_latitude" in spot
            assert "center_longitude" in spot
            assert "radius_meters" in spot

    def test_13_full_mobile_citizen_and_officer_workflow(self):
        """Verify end-to-end mobile citizen multipart submission -> tracking -> officer resolution."""
        # 1. Citizen submits Tamil complaint with photo
        jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xd9"
        create_resp = client.post(
            "/api/v1/complaints/with-photo",
            data={
                "citizen_text": "[Pothole] சாலையில் மிகப்பெரிய பள்ளம் உள்ளது (Landmark: Tiruchengode Bus Stand)",
                "latitude": "11.3635",
                "longitude": "77.8282",
            },
            files={"photo": ("mobile_pothole.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        assert create_resp.status_code == 201
        created = create_resp.json()
        trk_id = created["tracking_id"]
        comp_id = created["id"]

        # 2. Citizen tracks complaint by tracking_id
        trk_resp = client.get(f"/api/v1/complaints/track/{trk_id}")
        assert trk_resp.status_code == 200
        assert trk_resp.json()["id"] == comp_id

        # 3. Admin assigns to officer and resolves with photo proof
        admin_token = get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}
        st_resp = client.patch(
            f"/api/v1/officer/complaints/{comp_id}/status",
            json={"status": "IN_PROGRESS", "note": "Field inspection initiated via mobile"},
            headers=headers,
        )
        assert st_resp.status_code == 200

        res_resp = client.patch(
            f"/api/v1/officer/complaints/{comp_id}/resolve",
            data={"resolution_note": "Road patched with cold-mix asphalt and compacted."},
            files={"resolution_photo": ("resolved_proof.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
            headers=headers,
        )
        assert res_resp.status_code == 200
        resolved = res_resp.json()
        assert resolved["status"] == "RESOLVED"
        assert resolved["resolution_photo_url"] is not None

