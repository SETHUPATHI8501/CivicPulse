import concurrent.futures
import io
import re
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from main import app
from models import Complaint

client = TestClient(app)

CURRENT_YEAR = datetime.now(timezone.utc).year
CASE_ID_REGEX = re.compile(rf"^CP-{CURRENT_YEAR}-\d{{5}}$")
SOS_ID_REGEX = re.compile(rf"^SOS-{CURRENT_YEAR}-\d{{5}}$")


def _get_token(email: str, password: str) -> str:
    res = client.post("/api/v1/auth/token", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


class TestUnifiedCaseIdSynchronization:
    """
    Comprehensive 13-test verification suite for the CivicPulse AI Unified Case ID System
    and Real-Time Mobile/Web Synchronization.
    """

    def test_01_mobile_complaint_submission_returns_case_id(self):
        """1. Mobile multipart complaint submission returns backend-generated Case ID (CP-YYYY-NNNNN)."""
        jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xd9"
        res = client.post(
            "/api/v1/complaints/with-photo",
            data={
                "citizen_text": "Mobile reported deep pothole near Karur bus stand",
                "voice_transcript": "கரூர் பேருந்து நிலையம் அருகில் பெரிய சாலை குழி",
                "latitude": "10.9601",
                "longitude": "78.0766",
            },
            files={"photo": ("mobile_issue.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        assert res.status_code == 201
        data = res.json()
        assert "case_id" in data
        assert CASE_ID_REGEX.match(data["case_id"]), f"Unexpected Case ID format: {data['case_id']}"
        assert data["tracking_id"] == data["case_id"]

    def test_02_web_complaint_submission_returns_case_id(self):
        """2. Web JSON complaint submission returns backend-generated Case ID (CP-YYYY-NNNNN) and supports idempotency."""
        idem_key = "web-idem-test-2026-001"
        payload = {
            "citizen_text": "Web reported overflowing garbage bin on Main Bazaar Road",
            "latitude": 11.3802,
            "longitude": 77.8944,
            "idempotency_key": idem_key,
        }
        res1 = client.post("/api/v1/complaints", json=payload)
        assert res1.status_code == 201
        data1 = res1.json()
        assert CASE_ID_REGEX.match(data1["case_id"])

        # Repeated request with same idempotency_key returns the exact same record & Case ID
        res2 = client.post("/api/v1/complaints", json=payload)
        assert res2.status_code == 201
        data2 = res2.json()
        assert data2["id"] == data1["id"]
        assert data2["case_id"] == data1["case_id"]

    def test_03_mobile_and_web_receive_same_backend_generated_id(self):
        """3. A complaint submitted on Mobile is immediately visible on Web with the exact same Case ID."""
        create_res = client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Broken water supply pipeline flooding street corner",
                "latitude": 11.3635,
                "longitude": 77.8282,
            },
        )
        assert create_res.status_code == 201
        created = create_res.json()
        case_id = created["case_id"]

        # Web citizen track view
        web_track = client.get(f"/api/v1/complaints/track/{case_id}")
        assert web_track.status_code == 200
        assert web_track.json()["case_id"] == case_id
        assert web_track.json()["id"] == created["id"]

        # Web GIS nearby view
        gis_near = client.get(
            "/api/v1/gis/nearby",
            params={"latitude": 11.3635, "longitude": 77.8282, "radius_km": 2.0},
        )
        assert gis_near.status_code == 200
        near_ids = [item["case_id"] for item in gis_near.json()["items"]]
        assert case_id in near_ids

    def test_04_simultaneous_submissions_receive_different_case_ids(self):
        """4. Two simultaneous complaint submissions receive distinct sequential Case IDs."""
        def submit_one(idx: int):
            with TestClient(app) as local_client:
                r = local_client.post(
                    "/api/v1/complaints",
                    json={
                        "citizen_text": f"Concurrent submission test #{idx} streetlight fault",
                        "latitude": 11.3410 + (idx * 0.001),
                        "longitude": 77.7172 + (idx * 0.001),
                    },
                )
                assert r.status_code == 201
                return r.json()["case_id"]

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(submit_one, 1)
            f2 = pool.submit(submit_one, 2)
            cid1 = f1.result()
            cid2 = f2.result()

        assert cid1 != cid2
        assert CASE_ID_REGEX.match(cid1)
        assert CASE_ID_REGEX.match(cid2)

    def test_05_case_id_lookup_and_search_works(self):
        """5. Case ID lookup works via /track/{case_id}, /case/{case_id}, and ?case_id= search."""
        res = client.get("/api/v1/complaints/case/CP-2026-00093")
        assert res.status_code == 200
        data = res.json()
        assert data["case_id"] == "CP-2026-00093"
        assert data["id"] == 93

        search_res = client.get("/api/v1/complaints", params={"case_id": "CP-2026-00093"})
        assert search_res.status_code == 200
        items = search_res.json()["items"]
        assert len(items) == 1
        assert items[0]["case_id"] == "CP-2026-00093"

    def test_06_existing_complaints_retain_their_ids(self):
        """6. Existing complaints retain their legacy tracking_ids and backfilled CP-2026-NNNNN Case IDs."""
        # Lookup by legacy tracking_id CP-77B36589 (Complaint #93)
        res_legacy = client.get("/api/v1/complaints/track/CP-77B36589")
        assert res_legacy.status_code == 200
        d_legacy = res_legacy.json()
        assert d_legacy["id"] == 93
        assert d_legacy["tracking_id"] == "CP-77B36589"
        assert d_legacy["case_id"] == "CP-2026-00093"

        # Lookup by legacy tracking_id CP-6D07D491 (Complaint #1)
        res_first = client.get("/api/v1/complaints/track/CP-6D07D491")
        assert res_first.status_code == 200
        assert res_first.json()["tracking_id"] == "CP-6D07D491"
        assert res_first.json()["case_id"] == "CP-2026-00001"

    def test_07_database_uniqueness_constraint_enforced(self):
        """7. Database uniqueness constraint prevents duplicate case_id insertion."""
        db = SessionLocal()
        try:
            dup_comp = Complaint(
                case_id="CP-2026-00093",
                tracking_id="CP-UNIQUE-TEST-999",
                citizen_text="Attempted duplicate case_id insert",
                category="Other",
                priority="LOW",
                department="General",
                ai_source="RULE_BASED_FALLBACK",
                latitude=11.0,
                longitude=77.0,
                status="OPEN",
            )
            db.add(dup_comp)
            with pytest.raises(IntegrityError):
                db.commit()
            db.rollback()
        finally:
            db.close()

    def test_08_officer_dashboard_displays_case_id(self):
        """8. Officer dashboard displays Case ID and supports Case ID filtering."""
        admin_token = _get_token("admin@civicpulse.gov", "AdminPassword2026!")
        officer_token = _get_token("anitha.roads@civicpulse.gov", "AnithaSecurePass2026!")

        comp_res = client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Large road pothole hazard on highway entrance",
                "latitude": 11.3810,
                "longitude": 77.8950,
            },
        )
        assert comp_res.status_code == 201
        comp = comp_res.json()
        comp_id = comp["id"]
        case_id = comp["case_id"]

        assign_off = client.patch(
            f"/api/v1/officer/complaints/{comp_id}/assign",
            json={"officer_id": 2, "note": f"Assigning {case_id} to Anitha"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert assign_off.status_code == 200
        assert assign_off.json()["case_id"] == case_id

        off_list = client.get(
            "/api/v1/officer/complaints",
            params={"case_id": case_id},
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        assert off_list.status_code == 200
        assert off_list.json()["total"] == 1
        assert off_list.json()["items"][0]["case_id"] == case_id

    def test_09_worker_dashboard_displays_case_id(self):
        """9. Worker dashboard displays the exact same Case ID when dispatched."""
        admin_token = _get_token("admin@civicpulse.gov", "AdminPassword2026!")
        officer_token = _get_token("anitha.roads@civicpulse.gov", "AnithaSecurePass2026!")
        worker_token = _get_token("raju.worker@civicpulse.gov", "RajuWorkerPass2026!")

        comp_res = client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Deep crater on school road needing cold asphalt patching",
                "latitude": 11.3812,
                "longitude": 77.8952,
            },
        )
        comp = comp_res.json()
        comp_id = comp["id"]
        case_id = comp["case_id"]

        client.patch(
            f"/api/v1/officer/complaints/{comp_id}/assign",
            json={"officer_id": 2, "note": f"Assigning {case_id} to Anitha"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        worker_me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {worker_token}"},
        ).json()
        dispatch_res = client.patch(
            f"/api/v1/officer/complaints/{comp_id}/assign-worker",
            json={"worker_id": worker_me["id"], "note": f"Dispatching {case_id} to Raju"},
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        assert dispatch_res.status_code == 200
        assert dispatch_res.json()["case_id"] == case_id

        worker_list = client.get(
            "/api/v1/worker/complaints",
            headers={"Authorization": f"Bearer {worker_token}"},
        )
        assert worker_list.status_code == 200
        worker_cids = [item["case_id"] for item in worker_list.json()["items"]]
        assert case_id in worker_cids

    def test_10_admin_dashboard_displays_case_id(self):
        """10. Admin dashboard displays Case ID across all complaints and supports Case ID search."""
        admin_token = _get_token("admin@civicpulse.gov", "AdminPassword2026!")
        admin_list = client.get(
            "/api/v1/officer/complaints",
            params={"case_id": "CP-2026-00093"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_list.status_code == 200
        assert admin_list.json()["total"] == 1
        assert admin_list.json()["items"][0]["case_id"] == "CP-2026-00093"

    def test_11_status_updates_and_resolution_preserve_case_id_and_notify(self):
        """11. Status updates and resolution preserve Case ID and generate notifications with Case ID."""
        admin_token = _get_token("admin@civicpulse.gov", "AdminPassword2026!")
        headers = {"Authorization": f"Bearer {admin_token}"}

        comp_res = client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Damaged road divider needing urgent repair",
                "latitude": 11.3800,
                "longitude": 77.8940,
            },
        )
        comp = comp_res.json()
        comp_id = comp["id"]
        case_id = comp["case_id"]

        # Transition OPEN -> IN_PROGRESS
        st_res = client.patch(
            f"/api/v1/officer/complaints/{comp_id}/status",
            json={"status": "IN_PROGRESS", "note": "Repair crew on site"},
            headers=headers,
        )
        assert st_res.status_code == 200
        assert st_res.json()["case_id"] == case_id
        assert st_res.json()["status"] == "IN_PROGRESS"

        # Resolve with mandatory photo
        jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xd9"
        res_resolve = client.patch(
            f"/api/v1/officer/complaints/{comp_id}/resolve",
            data={"resolution_note": "Divider rebuilt and painted"},
            files={"resolution_photo": ("fixed.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
            headers=headers,
        )
        assert res_resolve.status_code == 200
        assert res_resolve.json()["case_id"] == case_id
        assert res_resolve.json()["status"] == "RESOLVED"

        # Verify citizen notifications include Case ID
        notifs = client.get("/api/v1/notifications", params={"tracking_id": case_id}).json()
        assert len(notifs) >= 2
        assert any(case_id in n["message"] for n in notifs)

    def test_12_sos_ids_remain_separate_from_complaint_case_ids(self):
        """12. SOS IDs use SOS-YYYY-NNNNN format and do not collide with or advance CP-YYYY-NNNNN."""
        sos_res = client.post(
            "/api/v1/sos",
            json={
                "emergency_type": "Fire hazard",
                "description": "Transformer fire near market street",
                "latitude": 11.3802,
                "longitude": 77.8944,
                "citizen_name": "Surya",
            },
        )
        assert sos_res.status_code == 201
        sos_data = sos_res.json()
        assert SOS_ID_REGEX.match(sos_data["case_id"]), f"Unexpected SOS Case ID: {sos_data['case_id']}"
        assert sos_data["tracking_id"] == sos_data["case_id"]
        assert not sos_data["case_id"].startswith("CP-")

    def test_13_unauthorized_users_cannot_access_private_citizen_complaint(self):
        """13. Private citizen complaints cannot be accessed by unauthorized users or unassigned staff."""
        priv_res = client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Private citizen grievance regarding residential drainage line",
                "latitude": 11.3805,
                "longitude": 77.8942,
                "is_private": True,
            },
        )
        assert priv_res.status_code == 201
        priv_data = priv_res.json()
        priv_id = priv_data["id"]
        priv_case_id = priv_data["case_id"]
        cit_token = priv_data["citizen_token"]
        assert cit_token is not None

        # 1. Another citizen / unauthenticated user enumerating by ID or Case ID without token gets 403
        unauth_id = client.get(f"/api/v1/complaints/{priv_id}")
        assert unauth_id.status_code == 403

        unauth_track = client.get(f"/api/v1/complaints/track/{priv_case_id}")
        assert unauth_track.status_code == 403

        # 2. Unassigned officer gets 403
        officer_token = _get_token("anitha.roads@civicpulse.gov", "AnithaSecurePass2026!")
        unassigned_off = client.get(
            f"/api/v1/complaints/{priv_id}",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        assert unassigned_off.status_code == 403

        # 3. Citizen with their citizen_token CAN access their own private complaint (200 OK)
        owner_res = client.get(
            f"/api/v1/complaints/track/{priv_case_id}",
            params={"citizen_token": cit_token},
        )
        assert owner_res.status_code == 200
        assert owner_res.json()["case_id"] == priv_case_id
