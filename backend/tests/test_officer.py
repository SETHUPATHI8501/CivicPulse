import os
import tempfile
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db, run_migrations
from main import app
from models import Complaint, Officer
from schemas.auth import OfficerCreate
from services.auth_service import hash_password
from services.officer_service import create_officer

# Create an isolated temporary SQLite database for Phase 5 tests
temp_db_fd, temp_db_path = tempfile.mkstemp(suffix="_test_phase5.db")
os.close(temp_db_fd)

test_engine = create_engine(
    f"sqlite:///{temp_db_path}",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


class Phase5OfficerManagementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.dependency_overrides[get_db] = override_get_db
        run_migrations(test_engine)
        cls.client = TestClient(app)

        # Seed an initial Admin account in test DB
        db = TestingSessionLocal()
        admin = Officer(
            name="Super Administrator",
            email="admin@civicpulse.gov",
            hashed_password=hash_password("AdminSecurePass123!"),
            department="Administration",
            role="ADMIN",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        cls.admin_id = admin.id
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        test_engine.dispose()
        if os.path.exists(temp_db_path):
            try:
                os.remove(temp_db_path)
            except OSError:
                pass

    def get_token(self, email, password):
        """Helper to obtain JWT bearer token."""
        res = self.client.post(
            "/api/v1/auth/token",
            json={"email": email, "password": password},
        )
        if res.status_code == 200:
            return res.json()["access_token"]
        return None

    # -------------------------------------------------------------
    # 1. Admin Login & Token Generation
    # -------------------------------------------------------------
    def test_01_admin_login_success(self):
        res = self.client.post(
            "/api/v1/auth/token",
            json={"email": "admin@civicpulse.gov", "password": "AdminSecurePass123!"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["token_type"], "bearer")
        self.assertEqual(data["role"], "ADMIN")

    def test_02_login_invalid_credentials(self):
        res = self.client.post(
            "/api/v1/auth/token",
            json={"email": "admin@civicpulse.gov", "password": "WrongPassword!"},
        )
        self.assertEqual(res.status_code, 401)

    def test_03_login_inactive_account(self):
        db = TestingSessionLocal()
        inactive_off = Officer(
            name="Inactive Officer",
            email="inactive@civicpulse.gov",
            hashed_password=hash_password("Password123!"),
            department="Sanitation",
            role="OFFICER",
            is_active=False,
        )
        db.add(inactive_off)
        db.commit()
        db.close()

        res = self.client.post(
            "/api/v1/auth/token",
            json={"email": "inactive@civicpulse.gov", "password": "Password123!"},
        )
        self.assertEqual(res.status_code, 401)

    # -------------------------------------------------------------
    # 2. Get Current Officer Profile
    # -------------------------------------------------------------
    def test_04_get_current_officer_me(self):
        token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")
        res = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["email"], "admin@civicpulse.gov")
        self.assertEqual(data["role"], "ADMIN")
        self.assertNotIn("hashed_password", data)

    def test_05_get_current_officer_unauthenticated(self):
        res = self.client.get("/api/v1/auth/me")
        self.assertEqual(res.status_code, 401)

    # -------------------------------------------------------------
    # 3. Officer Account Creation & RBAC
    # -------------------------------------------------------------
    def test_06_admin_creates_officer(self):
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")
        payload = {
            "name": "Officer Rajesh",
            "email": "rajesh.roads@civicpulse.gov",
            "password": "RajeshSecurePass123!",
            "department": "Roads / Public Works",
            "role": "OFFICER",
        }
        res = self.client.post(
            "/api/v1/officers",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["name"], "Officer Rajesh")
        self.assertEqual(data["email"], "rajesh.roads@civicpulse.gov")
        self.assertEqual(data["department"], "Roads / Public Works")
        self.assertEqual(data["role"], "OFFICER")
        self.assertTrue(data["is_active"])

    def test_07_officer_cannot_create_officer_forbidden(self):
        # Create second officer
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")
        self.client.post(
            "/api/v1/officers",
            json={
                "name": "Officer Priya",
                "email": "priya.sanitation@civicpulse.gov",
                "password": "PriyaSecurePass123!",
                "department": "Sanitation",
                "role": "OFFICER",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        priya_token = self.get_token("priya.sanitation@civicpulse.gov", "PriyaSecurePass123!")
        # Priya tries to create another officer -> must be 403 Forbidden
        res = self.client.post(
            "/api/v1/officers",
            json={
                "name": "Hacker Officer",
                "email": "hacker@civicpulse.gov",
                "password": "HackerPass123!",
                "department": "Sanitation",
                "role": "OFFICER",
            },
            headers={"Authorization": f"Bearer {priya_token}"},
        )
        self.assertEqual(res.status_code, 403)

    def test_08_duplicate_email_rejected(self):
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")
        res = self.client.post(
            "/api/v1/officers",
            json={
                "name": "Duplicate Rajesh",
                "email": "rajesh.roads@civicpulse.gov",
                "password": "AnotherPassword123!",
                "department": "Roads / Public Works",
                "role": "OFFICER",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(res.status_code, 400)

    # -------------------------------------------------------------
    # 4. Officer Listing & Department Filtering
    # -------------------------------------------------------------
    def test_09_list_officers_and_filter(self):
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")
        res_all = self.client.get(
            "/api/v1/officers",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(res_all.status_code, 200)
        self.assertTrue(res_all.json()["total"] >= 3)

        # Filter by department
        res_roads = self.client.get(
            "/api/v1/officers?department=Roads%20%2F%20Public%20Works",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(res_roads.status_code, 200)
        for item in res_roads.json()["items"]:
            self.assertEqual(item["department"], "Roads / Public Works")

    # -------------------------------------------------------------
    # 5. Complaint Assignment (Admin Only & Department Matching)
    # -------------------------------------------------------------
    def test_10_assign_complaint_matching_department(self):
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")

        # Create a Pothole complaint
        c_res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Large road crater pothole near railway station",
                "latitude": 11.3410,
                "longitude": 77.7172,
            },
        )
        complaint_id = c_res.json()["id"]
        self.assertEqual(c_res.json()["department"], "Roads / Public Works")

        # Get Rajesh's officer ID
        off_res = self.client.get(
            "/api/v1/officers?department=Roads%20%2F%20Public%20Works",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        rajesh_id = off_res.json()["items"][0]["id"]

        # Assign complaint to Rajesh (Department matches!)
        assign_res = self.client.patch(
            f"/api/v1/officer/complaints/{complaint_id}/assign",
            json={"officer_id": rajesh_id, "note": "Assigned to Zone 1 road engineer."},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(assign_res.status_code, 200)
        data = assign_res.json()
        self.assertEqual(data["assigned_officer_id"], rajesh_id)

        # Verify audit log
        audit_actions = [log["action"] for log in data["logs"]]
        self.assertIn("ASSIGNED", audit_actions)

    def test_11_assign_complaint_mismatched_department_rejected(self):
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")

        # Create a Garbage complaint (Sanitation department)
        c_res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Rotten waste dumping and garbage accumulation",
                "latitude": 11.3500,
                "longitude": 77.7200,
            },
        )
        complaint_id = c_res.json()["id"]
        self.assertEqual(c_res.json()["department"], "Sanitation")

        # Get Rajesh's ID (Roads department)
        off_res = self.client.get(
            "/api/v1/officers?department=Roads%20%2F%20Public%20Works",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        rajesh_id = off_res.json()["items"][0]["id"]

        # Attempt to assign Sanitation complaint to Roads officer -> must fail 400
        assign_res = self.client.patch(
            f"/api/v1/officer/complaints/{complaint_id}/assign",
            json={"officer_id": rajesh_id},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(assign_res.status_code, 400)
        self.assertIn("Department mismatch", assign_res.json()["detail"])

    # -------------------------------------------------------------
    # 6. Officer Complaint Queue Dashboard
    # -------------------------------------------------------------
    def test_12_officer_dashboard_visibility(self):
        rajesh_token = self.get_token("rajesh.roads@civicpulse.gov", "RajeshSecurePass123!")
        priya_token = self.get_token("priya.sanitation@civicpulse.gov", "PriyaSecurePass123!")
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")

        # Rajesh should see his assigned complaint
        res_rajesh = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertEqual(res_rajesh.status_code, 200)
        self.assertTrue(res_rajesh.json()["total"] >= 1)

        # Priya has no complaints assigned yet
        res_priya = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {priya_token}"},
        )
        self.assertEqual(res_priya.status_code, 200)
        self.assertEqual(res_priya.json()["total"], 0)

        # Admin can view all complaints
        res_admin = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(res_admin.status_code, 200)
        self.assertTrue(res_admin.json()["total"] > res_rajesh.json()["total"])

    # -------------------------------------------------------------
    # 7. Complaint Status Transitions
    # -------------------------------------------------------------
    def test_13_officer_status_transition_valid(self):
        rajesh_token = self.get_token("rajesh.roads@civicpulse.gov", "RajeshSecurePass123!")

        # Get Rajesh's assigned complaint
        q_res = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        c_id = q_res.json()["items"][0]["id"]

        # 1. Transition: OPEN -> IN_PROGRESS
        res1 = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/status",
            json={"status": "IN_PROGRESS", "note": "Inspection team deployed."},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.json()["status"], "IN_PROGRESS")

        # 2. Transition: IN_PROGRESS -> NEEDS_INFO
        res2 = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/status",
            json={"status": "NEEDS_INFO", "note": "Need more details from citizen."},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["status"], "NEEDS_INFO")

        # 3. Transition back: NEEDS_INFO -> IN_PROGRESS
        res3 = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/status",
            json={"status": "IN_PROGRESS", "note": "Citizen provided details; work in progress."},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertEqual(res3.status_code, 200)
        self.assertEqual(res3.json()["status"], "IN_PROGRESS")

    def test_14_invalid_status_transition_rejected(self):
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")

        # Create a new OPEN complaint
        c_res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Streetlight flickering continuously",
                "latitude": 11.3600,
                "longitude": 77.7300,
            },
        )
        c_id = c_res.json()["id"]
        self.assertEqual(c_res.json()["status"], "OPEN")

        # Attempt illegal transition: OPEN -> REJECTED is allowed, but invalid string is not
        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/status",
            json={"status": "CLOSED"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(res.status_code, 422)

    def test_15_unauthorized_officer_cannot_update_unassigned_complaint(self):
        priya_token = self.get_token("priya.sanitation@civicpulse.gov", "PriyaSecurePass123!")
        rajesh_token = self.get_token("rajesh.roads@civicpulse.gov", "RajeshSecurePass123!")

        # Get complaint assigned to Rajesh
        q_res = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        c_id = q_res.json()["items"][0]["id"]

        # Priya attempts to update status of Rajesh's complaint -> 403 Forbidden
        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/status",
            json={"status": "NEEDS_INFO"},
            headers={"Authorization": f"Bearer {priya_token}"},
        )
        self.assertEqual(res.status_code, 403)

    # -------------------------------------------------------------
    # 8. Phase 5 Final Corrections: Resolution & Migration Tests
    # -------------------------------------------------------------
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

    def test_16_resolution_without_photo_returns_422_or_400(self):
        rajesh_token = self.get_token("rajesh.roads@civicpulse.gov", "RajeshSecurePass123!")
        q_res = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        c_id = q_res.json()["items"][0]["id"]

        # Call resolve endpoint without resolution_photo multipart field
        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/resolve",
            data={"resolution_note": "Pothole successfully patched."},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertIn(res.status_code, [400, 422])

    def test_17_resolution_without_note_returns_422_or_400(self):
        rajesh_token = self.get_token("rajesh.roads@civicpulse.gov", "RajeshSecurePass123!")
        q_res = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        c_id = q_res.json()["items"][0]["id"]

        # 1. Missing resolution_note form field
        res1 = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/resolve",
            files={"resolution_photo": ("fix.jpg", self.MINIMAL_JPEG, "image/jpeg")},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertIn(res1.status_code, [400, 422])

        # 2. Empty / whitespace resolution_note
        res2 = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/resolve",
            data={"resolution_note": "   "},
            files={"resolution_photo": ("fix.jpg", self.MINIMAL_JPEG, "image/jpeg")},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertIn(res2.status_code, [400, 422])

    def test_18_resolution_with_invalid_image_type_returns_400(self):
        rajesh_token = self.get_token("rajesh.roads@civicpulse.gov", "RajeshSecurePass123!")
        q_res = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        c_id = q_res.json()["items"][0]["id"]

        # Upload a plain text file pretending to be resolution proof
        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/resolve",
            data={"resolution_note": "Done with repairs."},
            files={"resolution_photo": ("report.txt", b"plain text report instead of image", "text/plain")},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid file extension", res.json()["detail"])

    def test_19_resolution_with_image_larger_than_5mb_returns_400(self):
        rajesh_token = self.get_token("rajesh.roads@civicpulse.gov", "RajeshSecurePass123!")
        q_res = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        c_id = q_res.json()["items"][0]["id"]

        # Oversized file (> 5 MB = 5,242,880 bytes)
        large_image_bytes = self.MINIMAL_JPEG + (b"\x00" * (5 * 1024 * 1024 + 1024))
        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/resolve",
            data={"resolution_note": "Repair completed."},
            files={"resolution_photo": ("large_proof.jpg", large_image_bytes, "image/jpeg")},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("exceeds 5 MB", res.json()["detail"])

    def test_20_successful_resolution_returns_200_and_status_resolved(self):
        rajesh_token = self.get_token("rajesh.roads@civicpulse.gov", "RajeshSecurePass123!")
        q_res = self.client.get(
            "/api/v1/officer/complaints",
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        c_id = q_res.json()["items"][0]["id"]

        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/resolve",
            data={"resolution_note": "Road crater completely filled with asphalt and compacted."},
            files={"resolution_photo": ("road_repaired.jpg", self.MINIMAL_JPEG, "image/jpeg")},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "RESOLVED")
        self.assertEqual(data["resolution_note"], "Road crater completely filled with asphalt and compacted.")
        self.assertTrue(data["resolution_photo_url"].startswith("/uploads/resolutions/res_"))

    def test_21_resolution_attempt_by_unauthorized_officer_returns_403(self):
        priya_token = self.get_token("priya.sanitation@civicpulse.gov", "PriyaSecurePass123!")
        rajesh_token = self.get_token("rajesh.roads@civicpulse.gov", "RajeshSecurePass123!")

        # Create a new complaint assigned to Rajesh and set to IN_PROGRESS
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")
        c_res = self.client.post(
            "/api/v1/complaints",
            json={"citizen_text": "Pothole on Main St", "latitude": 11.3415, "longitude": 77.7175},
        )
        c_id = c_res.json()["id"]

        # Assign to Rajesh
        off_res = self.client.get(
            "/api/v1/officers?department=Roads%20%2F%20Public%20Works",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        rajesh_id = off_res.json()["items"][0]["id"]
        self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/assign",
            json={"officer_id": rajesh_id},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Set IN_PROGRESS
        self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/status",
            json={"status": "IN_PROGRESS"},
            headers={"Authorization": f"Bearer {rajesh_token}"},
        )

        # Priya (unauthorized) attempts to resolve Rajesh's complaint -> 403 Forbidden
        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/resolve",
            data={"resolution_note": "Priya resolving another department issue"},
            files={"resolution_photo": ("fix.jpg", self.MINIMAL_JPEG, "image/jpeg")},
            headers={"Authorization": f"Bearer {priya_token}"},
        )
        self.assertEqual(res.status_code, 403)

    def test_22_resolution_attempt_when_status_is_open_returns_400(self):
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")

        # Create an OPEN complaint
        c_res = self.client.post(
            "/api/v1/complaints",
            json={"citizen_text": "Water leaking from pipe", "latitude": 11.355, "longitude": 77.725},
        )
        c_id = c_res.json()["id"]

        # Attempt to resolve directly from OPEN without IN_PROGRESS -> 400
        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/resolve",
            data={"resolution_note": "Pipe repaired directly from open state"},
            files={"resolution_photo": ("pipe.jpg", self.MINIMAL_JPEG, "image/jpeg")},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("must be IN_PROGRESS", res.json()["detail"])

    def test_23_resolution_audit_log_properly_created(self):
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")

        # Create, assign, and set IN_PROGRESS
        c_res = self.client.post(
            "/api/v1/complaints",
            json={"citizen_text": "Drainage blocked on South St", "latitude": 11.350, "longitude": 77.710},
        )
        c_id = c_res.json()["id"]

        self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/status",
            json={"status": "IN_PROGRESS"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Resolve as Admin
        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/resolve",
            data={"resolution_note": "Drainage desilted and cleared using suction machine."},
            files={"resolution_photo": ("drain_clean.jpg", self.MINIMAL_JPEG, "image/jpeg")},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(res.status_code, 200)
        logs = res.json()["logs"]

        # Find RESOLVED log
        resolved_logs = [l for l in logs if l["action"] == "RESOLVED"]
        self.assertTrue(len(resolved_logs) >= 1)
        res_log = resolved_logs[-1]
        self.assertEqual(res_log["old_status"], "IN_PROGRESS")
        self.assertEqual(res_log["new_status"], "RESOLVED")
        self.assertEqual(res_log["officer_id"], self.admin_id)
        self.assertEqual(res_log["note"], "Drainage desilted and cleared using suction machine.")

    def test_24_status_api_cannot_directly_set_resolved(self):
        admin_token = self.get_token("admin@civicpulse.gov", "AdminSecurePass123!")

        # Create complaint and move to IN_PROGRESS
        c_res = self.client.post(
            "/api/v1/complaints",
            json={"citizen_text": "Garbage burning near park", "latitude": 11.365, "longitude": 77.735},
        )
        c_id = c_res.json()["id"]

        self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/status",
            json={"status": "IN_PROGRESS"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Attempt to set RESOLVED via standard /status API -> MUST be rejected with 400
        res = self.client.patch(
            f"/api/v1/officer/complaints/{c_id}/status",
            json={"status": "RESOLVED", "note": "Bypassing resolution endpoint"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("prohibited via status endpoint", res.json()["detail"])

    def test_25_database_migration_preserves_existing_records(self):
        """Verify migration against a separate temporary SQLite database."""
        m_fd, m_path = tempfile.mkstemp(suffix="_migration_test.db")
        os.close(m_fd)

        try:
            m_engine = create_engine(
                f"sqlite:///{m_path}",
                connect_args={"check_same_thread": False},
            )
            MSession = sessionmaker(bind=m_engine)

            # 1. Run migrations initially to establish schema
            run_migrations(m_engine)

            # 2. Insert records
            db = MSession()
            test_officer = Officer(
                name="Migration Test Officer",
                email="mig_test@civicpulse.gov",
                hashed_password=hash_password("Pass123!"),
                department="Roads / Public Works",
                role="OFFICER",
                is_active=True,
            )
            test_complaint = Complaint(
                tracking_id="CP-MIGTEST01",
                citizen_text="Existing complaint before repeated migration",
                latitude=11.34,
                longitude=77.71,
                category="Pothole",
                priority="HIGH",
                department="Roads / Public Works",
                ai_source="TEST",
                status="OPEN",
            )
            db.add(test_officer)
            db.add(test_complaint)
            db.commit()

            pre_officers_count = db.query(Officer).count()
            pre_complaints_count = db.query(Complaint).count()
            self.assertEqual(pre_officers_count, 1)
            self.assertEqual(pre_complaints_count, 1)
            db.close()

            # 3. Re-run migration
            run_migrations(m_engine)

            # 4. Verify records intact
            db2 = MSession()
            post_officers_count = db2.query(Officer).count()
            post_complaints_count = db2.query(Complaint).count()
            migrated_complaint = db2.query(Complaint).filter_by(tracking_id="CP-MIGTEST01").first()

            self.assertEqual(pre_officers_count, post_officers_count)
            self.assertEqual(pre_complaints_count, post_complaints_count)
            self.assertIsNotNone(migrated_complaint)
            self.assertEqual(migrated_complaint.citizen_text, "Existing complaint before repeated migration")
            db2.close()
            m_engine.dispose()
        finally:
            if os.path.exists(m_path):
                try:
                    os.remove(m_path)
                except OSError:
                    pass
            bak_path = m_path + ".bak"
            if os.path.exists(bak_path):
                try:
                    os.remove(bak_path)
                except OSError:
                    pass

    def test_26_database_migration_can_run_more_than_once_safely(self):
        """Verify migration idempotency when executed repeatedly."""
        m_fd, m_path = tempfile.mkstemp(suffix="_idempotency_test.db")
        os.close(m_fd)

        try:
            m_engine = create_engine(
                f"sqlite:///{m_path}",
                connect_args={"check_same_thread": False},
            )
            # Run migration 3 consecutive times without errors
            run_migrations(m_engine)
            run_migrations(m_engine)
            run_migrations(m_engine)

            MSession = sessionmaker(bind=m_engine)
            db = MSession()
            # Verify can insert and query successfully
            test_off = Officer(
                name="Idempotency Officer",
                email="idem@civicpulse.gov",
                hashed_password=hash_password("Pass123!"),
                department="Administration",
                role="ADMIN",
                is_active=True,
            )
            db.add(test_off)
            db.commit()
            self.assertEqual(db.query(Officer).count(), 1)
            db.close()
            m_engine.dispose()
        finally:
            if os.path.exists(m_path):
                try:
                    os.remove(m_path)
                except OSError:
                    pass
            bak_path = m_path + ".bak"
            if os.path.exists(bak_path):
                try:
                    os.remove(bak_path)
                except OSError:
                    pass


if __name__ == "__main__":
    unittest.main()

