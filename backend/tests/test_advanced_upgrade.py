import io
import pytest
from fastapi.testclient import TestClient

from main import app
from database import engine, run_migrations

client = TestClient(app)


def get_admin_token() -> str:
    res = client.post(
        "/api/v1/auth/token",
        json={"email": "admin@civicpulse.gov", "password": "AdminPassword2026!"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def get_officer_token() -> str:
    res = client.post(
        "/api/v1/auth/token",
        json={"email": "anitha.roads@civicpulse.gov", "password": "AnithaSecurePass2026!"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


class TestAdvancedCivicPulseUpgrade:
    """Comprehensive test suite for GIS, Tamil/English Voice, AI Assistant, SOS, Worker Role & WebSockets."""

    def test_01_gis_reverse_geocoding_en_and_ta(self):
        """Verify reverse geocoding returns readable English and Tamil addresses."""
        run_migrations(engine)
        res_en = client.get(
            "/api/v1/gis/reverse-geocode",
            params={"latitude": 11.3802, "longitude": 77.8944, "lang": "en"},
        )
        assert res_en.status_code == 200
        data_en = res_en.json()
        assert "address" in data_en
        assert "nearest_landmark" in data_en

        res_ta = client.get(
            "/api/v1/gis/reverse-geocode",
            params={"latitude": 11.3802, "longitude": 77.8944, "lang": "ta"},
        )
        assert res_ta.status_code == 200
        data_ta = res_ta.json()
        assert "address" in data_ta

    def test_02_gis_nearby_complaints_and_route_estimate(self):
        """Verify nearby complaints search and Haversine route/ETA estimation."""
        res_near = client.get(
            "/api/v1/gis/nearby",
            params={"latitude": 11.3802, "longitude": 77.8944, "radius_km": 15.0},
        )
        assert res_near.status_code == 200
        near_data = res_near.json()
        assert "total" in near_data
        assert isinstance(near_data["items"], list)

        res_route = client.get(
            "/api/v1/gis/route-estimate",
            params={
                "from_lat": 11.3635,
                "from_lon": 77.8282,
                "to_lat": 11.3802,
                "to_lon": 77.8944,
            },
        )
        assert res_route.status_code == 200
        route_data = res_route.json()
        assert route_data["straight_distance_meters"] > 0
        assert route_data["estimated_road_distance_km"] > 0
        assert route_data["estimated_travel_minutes"] >= 1
        assert "google_maps_directions_url" in route_data

    def test_03_voice_assistant_tamil_english_and_mixed(self):
        """Verify Tamil Unicode preservation, English transcription, and code-switching."""
        # 1. Pure Tamil speech
        res_ta = client.post(
            "/api/v1/voice/process",
            json={
                "transcript": "எங்கள் தெருவில் தண்ணீர் தேங்கி இருக்கிறது.",
                "preferred_language": "ta",
            },
        )
        assert res_ta.status_code == 200
        data_ta = res_ta.json()
        assert data_ta["detected_language"] == "ta"
        assert data_ta["preserves_tamil_unicode"] is True
        assert "எங்கள் தெருவில்" in data_ta["original_transcript"]
        assert data_ta["tts_language_code"] == "ta-IN"

        # 2. Pure English speech
        res_en = client.post(
            "/api/v1/voice/process",
            json={
                "transcript": "There is a large pothole near my street causing accidents.",
                "preferred_language": "en",
            },
        )
        assert res_en.status_code == 200
        data_en = res_en.json()
        assert data_en["detected_language"] == "en"
        assert data_en["suggested_category"] == "Pothole"
        assert data_en["tts_language_code"] == "en-IN"

        # 3. Code-switched Tamil + English speech
        res_mix = client.post(
            "/api/v1/voice/process",
            json={
                "transcript": "Main road அருகில் பெரிய pothole மற்றும் குப்பை உள்ளது",
                "preferred_language": "ta",
            },
        )
        assert res_mix.status_code == 200
        data_mix = res_mix.json()
        assert data_mix["detected_language"] == "mixed"
        assert data_mix["preserves_tamil_unicode"] is True

    def test_04_ai_civic_assistant_citizen_officer_and_admin(self):
        """Verify Gemini + deterministic fallback AI assistant across roles and languages."""
        # Citizen Tamil query
        cit_res = client.post(
            "/api/v1/ai/assistant",
            json={
                "prompt": "எங்கள் பகுதியில் குப்பைகள் அகற்றப்படவில்லை, என்ன செய்வது?",
                "role_context": "CITIZEN",
                "language": "ta",
            },
        )
        assert cit_res.status_code == 200
        cit_data = cit_res.json()
        assert cit_data["role_context"] == "CITIZEN"
        assert len(cit_data["reply"]) > 10

        # Admin intelligence query with auth
        admin_token = get_admin_token()
        adm_res = client.post(
            "/api/v1/ai/assistant",
            json={
                "prompt": "Provide executive summary of overdue SLA complaints and hotspots.",
                "role_context": "ADMIN",
                "language": "en",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert adm_res.status_code == 200
        adm_data = adm_res.json()
        assert adm_data["role_context"] == "ADMIN"
        assert "live_metrics" in adm_data
        assert "overdue_sla_count" in adm_data["live_metrics"]

    def test_05_sos_emergency_full_lifecycle_and_rbac(self):
        """Verify SOS submission, public privacy restriction, officer acknowledgment, and resolution."""
        # 1. Citizen submits SOS emergency with photo
        jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xd9"
        sos_res = client.post(
            "/api/v1/sos/with-photo",
            data={
                "emergency_type": "Fallen electric pole or dangerous electrical hazard",
                "description": "Live sparking electric transformer wire fallen across wet road near bus stand",
                "latitude": "11.3802",
                "longitude": "77.8944",
                "citizen_name": "Karthik S",
                "citizen_phone": "9876543210",
            },
            files={"photo": ("sos_hazard.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        assert sos_res.status_code == 201
        sos_data = sos_res.json()
        sos_id = sos_data["id"]
        sos_trk = sos_data["tracking_id"]
        assert sos_trk.startswith("SOS-")
        assert sos_data["status"] == "SUBMITTED"
        assert sos_data["priority"] == "CRITICAL"
        assert sos_data["photo_url"].startswith("/uploads/sos/")

        # 2. Unauthenticated public user CANNOT list all SOS alerts (401 Unauthorized)
        unauth_list = client.get("/api/v1/sos")
        assert unauth_list.status_code == 401

        # 3. Citizen tracks their own SOS by tracking_id
        trk_res = client.get(f"/api/v1/sos/track/{sos_trk}")
        assert trk_res.status_code == 200
        assert trk_res.json()["id"] == sos_id

        # 4. Officer lists SOS alerts and acknowledges -> responds -> resolves
        officer_token = get_officer_token()
        off_headers = {"Authorization": f"Bearer {officer_token}"}

        list_res = client.get("/api/v1/sos", headers=off_headers)
        assert list_res.status_code == 200
        assert list_res.json()["total"] >= 1

        ack_res = client.patch(
            f"/api/v1/sos/{sos_id}/status",
            json={"status": "ACKNOWLEDGED", "note": "Emergency electrical squad alerted."},
            headers=off_headers,
        )
        assert ack_res.status_code == 200
        assert ack_res.json()["status"] == "ACKNOWLEDGED"

        resp_res = client.patch(
            f"/api/v1/sos/{sos_id}/status",
            json={"status": "RESPONDING", "note": "Responder team en route to isolate feeder."},
            headers=off_headers,
        )
        assert resp_res.status_code == 200
        assert resp_res.json()["status"] == "RESPONDING"

        resolve_res = client.patch(
            f"/api/v1/sos/{sos_id}/status",
            json={"status": "RESOLVED", "note": "Power line isolated and pole secured safely."},
            headers=off_headers,
        )
        assert resolve_res.status_code == 200
        assert resolve_res.json()["status"] == "RESOLVED"
        assert len(resolve_res.json()["logs"]) >= 4

    def test_06_worker_role_rbac_and_field_workflow(self):
        """Verify WORKER creation, officer dispatch, worker field photo upload, and RBAC."""
        admin_token = get_admin_token()
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Admin creates a WORKER account
        worker_email = "test.field.worker@civicpulse.gov"
        create_w = client.post(
            "/api/v1/officers",
            json={
                "name": "Muthu Field Worker",
                "email": worker_email,
                "password": "WorkerSecure2026!",
                "department": "Roads / Public Works",
                "role": "WORKER",
            },
            headers=admin_headers,
        )
        assert create_w.status_code in [201, 400]

        # 2. Worker logs in and receives WORKER role JWT
        w_login = client.post(
            "/api/v1/auth/token",
            json={"email": worker_email, "password": "WorkerSecure2026!"},
        )
        assert w_login.status_code == 200
        w_data = w_login.json()
        assert w_data["role"] == "WORKER"
        worker_headers = {"Authorization": f"Bearer {w_data['access_token']}"}

        # Verify worker profile ID
        w_me = client.get("/api/v1/auth/me", headers=worker_headers).json()
        worker_id = w_me["id"]

        # 3. Worker CANNOT access Admin-only /officers or Officer-only /sos list (403 Forbidden)
        assert client.get("/api/v1/officers", headers=worker_headers).status_code == 403
        assert client.get("/api/v1/sos", headers=worker_headers).status_code == 403

        # 4. Citizen creates a complaint, Admin assigns Officer #2, Officer dispatches Worker
        comp_res = client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Deep road pothole near bus stand entrance requiring cold mix patching",
                "latitude": 11.3805,
                "longitude": 77.8940,
            },
        )
        assert comp_res.status_code == 201
        comp_id = comp_res.json()["id"]

        client.patch(
            f"/api/v1/officer/complaints/{comp_id}/assign",
            json={"officer_id": 2, "note": "Assigning to Roads Officer Anitha."},
            headers=admin_headers,
        )

        officer_token = get_officer_token()
        officer_headers = {"Authorization": f"Bearer {officer_token}"}

        dispatch_res = client.patch(
            f"/api/v1/officer/complaints/{comp_id}/assign-worker",
            json={"worker_id": worker_id, "note": "Patch pothole and upload before/after photos."},
            headers=officer_headers,
        )
        assert dispatch_res.status_code == 200
        assert dispatch_res.json()["assigned_worker_id"] == worker_id

        # 5. Worker views assigned queue and uploads before/after photos + completion note
        w_queue = client.get("/api/v1/worker/complaints", headers=worker_headers)
        assert w_queue.status_code == 200
        assert w_queue.json()["total"] >= 1

        jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xd9"
        prog_res = client.patch(
            f"/api/v1/worker/complaints/{comp_id}/progress",
            data={
                "work_status": "WORK_COMPLETED",
                "completion_note": "Cleaned crater, applied bitumen tack coat and cold asphalt mix.",
            },
            files={
                "before_photo": ("before.jpg", io.BytesIO(jpeg_bytes), "image/jpeg"),
                "after_photo": ("after.jpg", io.BytesIO(jpeg_bytes), "image/jpeg"),
            },
            headers=worker_headers,
        )
        assert prog_res.status_code == 200
        updated_comp = prog_res.json()
        assert updated_comp["status"] == "IN_PROGRESS"
        assert updated_comp["worker_before_photo_url"].startswith("/uploads/workers/")
        assert updated_comp["worker_after_photo_url"].startswith("/uploads/workers/")
        assert "cold asphalt mix" in updated_comp["worker_completion_note"]

    def test_07_notifications_and_websocket_stream(self):
        """Verify polling notifications endpoint and real-time WebSocket connection."""
        admin_token = get_admin_token()
        notifs_res = client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert notifs_res.status_code == 200
        assert isinstance(notifs_res.json(), list)

        with client.websocket_connect("/api/v1/ws/updates") as ws:
            welcome = ws.receive_json()
            assert welcome["event"] == "CONNECTED"
            ws.send_text("ping")
            pong = ws.receive_json()
            assert pong["event"] == "PONG"

