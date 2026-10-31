import json
import os
import tempfile
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models import Complaint
from services.ai_classifier import classify_complaint
from services.duplicate_detector import (
    calculate_distance,
    calculate_jaccard_similarity,
    normalize_text_for_similarity,
)
from services.fallback_classifier import classify_fallback

# Create an isolated temporary SQLite database for Phase 4 testing
temp_db_fd, temp_db_path = tempfile.mkstemp(suffix="_test_phase4.db")
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


class Phase4DuplicateDetectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.dependency_overrides[get_db] = override_get_db
        Base.metadata.create_all(bind=test_engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        test_engine.dispose()
        if os.path.exists(temp_db_path):
            try:
                os.remove(temp_db_path)
            except OSError:
                pass

    # -------------------------------------------------------------
    # 1. Haversine distance between nearby coordinates
    # -------------------------------------------------------------
    def test_01_haversine_distance_nearby(self):
        # 11.3410, 77.7172 to 11.3413, 77.7174 is approx 39.8 metres
        dist = calculate_distance(11.3410, 77.7172, 11.3413, 77.7174)
        self.assertTrue(35.0 <= dist <= 45.0, f"Expected ~40m, got {dist}")
        self.assertTrue(dist <= 100.0)

    # -------------------------------------------------------------
    # 2. Haversine distance between distant coordinates
    # -------------------------------------------------------------
    def test_02_haversine_distance_distant(self):
        # Local distance beyond 100m (~222m)
        dist_local = calculate_distance(11.3410, 77.7172, 11.3430, 77.7172)
        self.assertTrue(dist_local > 100.0, f"Expected >100m, got {dist_local}")

        # Inter-city distance (~338km)
        dist_city = calculate_distance(11.3410, 77.7172, 13.0827, 80.2707)
        self.assertTrue(dist_city > 300000.0, f"Expected >300km, got {dist_city}")

    # -------------------------------------------------------------
    # 3. Identical English text similarity
    # -------------------------------------------------------------
    def test_03_identical_english_text_similarity(self):
        text = "Dangerous deep pothole on the main road"
        sim = calculate_jaccard_similarity(text, text)
        self.assertEqual(sim, 1.0)

    # -------------------------------------------------------------
    # 4. Similar English complaint similarity
    # -------------------------------------------------------------
    def test_04_similar_english_complaint_similarity(self):
        t1 = "Dangerous deep pothole on main road causing accidents"
        t2 = "Dangerous deep pothole on main road causing two-wheeler accidents"
        sim = calculate_jaccard_similarity(t1, t2)
        self.assertTrue(sim > 0.60, f"Expected Jaccard > 0.60, got {sim}")

    # -------------------------------------------------------------
    # 5. Tamil text normalization
    # -------------------------------------------------------------
    def test_05_tamil_text_normalization(self):
        tamil_raw = "சாலையில் பெரிய குழி உள்ளது! விபத்து அபாயம்..."
        tokens = normalize_text_for_similarity(tamil_raw)
        self.assertIsInstance(tokens, set)
        self.assertIn("சாலையில்", tokens)
        self.assertIn("பெரிய", tokens)
        self.assertIn("குழி", tokens)
        self.assertIn("உள்ளது", tokens)
        self.assertIn("விபத்து", tokens)
        self.assertIn("அபாயம்", tokens)

    # -------------------------------------------------------------
    # 6. Tamil complaint similarity
    # -------------------------------------------------------------
    def test_06_tamil_complaint_similarity(self):
        t1 = "சாலையில் பெரிய குழி உள்ளது விபத்து அபாயம்"
        t2 = "சாலையில் பெரிய குழி உள்ளது வாகன விபத்து"
        sim = calculate_jaccard_similarity(t1, t2)
        self.assertTrue(sim > 0.60, f"Expected Jaccard > 0.60 for Tamil texts, got {sim}")

    # -------------------------------------------------------------
    # 7. Empty text handling
    # -------------------------------------------------------------
    def test_07_empty_text_handling(self):
        self.assertEqual(calculate_jaccard_similarity("", "pothole on road"), 0.0)
        self.assertEqual(calculate_jaccard_similarity("pothole on road", ""), 0.0)
        self.assertEqual(calculate_jaccard_similarity("", ""), 0.0)
        self.assertEqual(calculate_jaccard_similarity("   ", "\n\t"), 0.0)

    # -------------------------------------------------------------
    # 8. Same category and nearby location detects duplicate
    # -------------------------------------------------------------
    def test_08_same_category_and_nearby_location_detects_duplicate(self):
        # 1. First complaint (original)
        c1_res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Dangerous large crater pothole near bus terminal road",
                "latitude": 11.3410,
                "longitude": 77.7172,
            },
        )
        self.assertEqual(c1_res.status_code, 201)
        c1 = c1_res.json()
        self.assertEqual(c1["category"], "Pothole")

        # 2. Second complaint (~25m away, very similar text)
        c2_res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Dangerous large crater pothole near bus terminal road daily",
                "latitude": 11.3412,
                "longitude": 77.7173,
            },
        )
        self.assertEqual(c2_res.status_code, 201)
        c2 = c2_res.json()

        self.assertEqual(c2["category"], "Pothole")
        self.assertIsNotNone(c2["duplicate_group_id"])
        self.assertTrue(c2["duplicate_group_id"].startswith("DUP-"))
        self.assertIsNotNone(c2["duplicate_confidence"])
        self.assertTrue(c2["duplicate_confidence"] > 0.60)

    # -------------------------------------------------------------
    # 9. Different category does not detect duplicate
    # -------------------------------------------------------------
    def test_09_different_category_does_not_detect_duplicate(self):
        # At same GPS location as test_08, but Garbage category
        res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Overflowing garbage bin and stinking waste dump",
                "latitude": 11.3410,
                "longitude": 77.7172,
            },
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["category"], "Garbage")
        self.assertIsNone(data["duplicate_group_id"])
        self.assertIsNone(data["duplicate_confidence"])

    # -------------------------------------------------------------
    # 10. Same category but location beyond 100 metres does not detect duplicate
    # -------------------------------------------------------------
    def test_10_same_category_but_location_beyond_100_metres_does_not_detect_duplicate(self):
        # Same text as test_08, but 250m away (lat 11.3435 vs 11.3410)
        res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Dangerous large crater pothole near bus terminal road",
                "latitude": 11.3435,
                "longitude": 77.7172,
            },
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["category"], "Pothole")
        self.assertIsNone(data["duplicate_group_id"])
        self.assertIsNone(data["duplicate_confidence"])

    # -------------------------------------------------------------
    # 11. Similarity at or below 0.60 does not detect duplicate
    # -------------------------------------------------------------
    def test_11_similarity_at_or_below_0_60_does_not_detect_duplicate(self):
        # Nearby (11.3411, 77.7172), Pothole, but text vocabulary does not overlap > 0.60
        res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Minor asphalt crack along sidewalk curb",
                "latitude": 11.3411,
                "longitude": 77.7172,
            },
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        # Even if category matches Pothole, low text similarity rejects duplicate grouping
        self.assertIsNone(data["duplicate_group_id"])
        self.assertIsNone(data["duplicate_confidence"])

    # -------------------------------------------------------------
    # 12. Existing complaint receives duplicate group ID
    # -------------------------------------------------------------
    def test_12_existing_complaint_receives_duplicate_group_id(self):
        # Submit fresh original complaint
        orig_res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Water pipeline burst creating major flooding on crossroad",
                "latitude": 11.3500,
                "longitude": 77.7200,
            },
        )
        orig_id = orig_res.json()["id"]

        # Initially no duplicate group
        self.assertIsNone(orig_res.json()["duplicate_group_id"])

        # Submit duplicate complaint nearby
        dup_res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Water pipeline burst creating major flooding on crossroad street",
                "latitude": 11.3501,
                "longitude": 77.7201,
            },
        )
        dup_group_id = dup_res.json()["duplicate_group_id"]
        self.assertIsNotNone(dup_group_id)

        # Check that original complaint #orig_id now also has dup_group_id!
        fetch_orig = self.client.get(f"/api/v1/complaints/{orig_id}")
        self.assertEqual(fetch_orig.status_code, 200)
        self.assertEqual(fetch_orig.json()["duplicate_group_id"], dup_group_id)

    # -------------------------------------------------------------
    # 13. New complaint joins existing duplicate group
    # -------------------------------------------------------------
    def test_13_new_complaint_joins_existing_duplicate_group(self):
        # Submit a 3rd complaint matching the water burst from test_12
        third_res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Water pipeline burst creating major flooding on crossroad corner",
                "latitude": 11.3502,
                "longitude": 77.7200,
            },
        )
        self.assertEqual(third_res.status_code, 201)
        third_data = third_res.json()

        # Should join the existing group from test_12
        self.assertIsNotNone(third_data["duplicate_group_id"])
        self.assertTrue(third_data["duplicate_group_id"].startswith("DUP-"))

    # -------------------------------------------------------------
    # 14. Original complaint record is preserved
    # -------------------------------------------------------------
    def test_14_original_complaint_record_is_preserved(self):
        # All complaints submitted still exist in the database with their original IDs
        list_res = self.client.get("/api/v1/complaints?limit=50")
        self.assertEqual(list_res.status_code, 200)
        total = list_res.json()["total"]
        self.assertTrue(total >= 6)

    # -------------------------------------------------------------
    # 15. RESOLVED and REJECTED complaints are excluded
    # -------------------------------------------------------------
    def test_15_resolved_and_rejected_complaints_are_excluded(self):
        # 1. Create complaint and mark as RESOLVED in DB
        res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Broken streetlight unlit in front of post office",
                "latitude": 11.3600,
                "longitude": 77.7300,
            },
        )
        c_id = res.json()["id"]

        # Update status directly in test DB to RESOLVED
        db = TestingSessionLocal()
        c = db.query(Complaint).filter_by(id=c_id).first()
        c.status = "RESOLVED"
        db.commit()
        db.close()

        # 2. Submit identical complaint nearby
        new_res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Broken streetlight unlit in front of post office",
                "latitude": 11.3601,
                "longitude": 77.7301,
            },
        )
        self.assertEqual(new_res.status_code, 201)
        new_data = new_res.json()

        # Should NOT link to the RESOLVED complaint
        self.assertIsNone(new_data["duplicate_group_id"])
        self.assertIsNone(new_data["duplicate_confidence"])

    # -------------------------------------------------------------
    # 16. No duplicate produces null duplicate fields
    # -------------------------------------------------------------
    def test_16_no_duplicate_produces_null_duplicate_fields(self):
        res = self.client.post(
            "/api/v1/complaints",
            json={
                "citizen_text": "Completely unique drainage sewer choke in isolated ward",
                "latitude": 11.3900,
                "longitude": 77.7900,
            },
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIsNone(data["duplicate_group_id"])
        self.assertIsNone(data["duplicate_confidence"])

    # -------------------------------------------------------------
    # 17. Existing Phase 2 and Phase 3 APIs continue working
    # -------------------------------------------------------------
    def test_17_existing_phase2_and_phase3_apis_continue_working(self):
        # 1. Health check
        h_res = self.client.get("/health")
        self.assertEqual(h_res.status_code, 200)
        self.assertEqual(h_res.json(), {"status": "healthy", "database": "connected"})

        # 2. Root check
        r_res = self.client.get("/")
        self.assertEqual(r_res.status_code, 200)

        # 3. Pydantic validation failure on empty text
        err_res = self.client.post(
            "/api/v1/complaints",
            json={"citizen_text": "   ", "latitude": 11.0, "longitude": 77.0},
        )
        self.assertEqual(err_res.status_code, 422)

        # 4. Tracking endpoint
        res = self.client.post(
            "/api/v1/complaints",
            json={"citizen_text": "Pothole on service lane", "latitude": 11.1, "longitude": 77.1},
        )
        t_id = res.json()["tracking_id"]
        track_res = self.client.get(f"/api/v1/complaints/track/{t_id}")
        self.assertEqual(track_res.status_code, 200)
        self.assertEqual(track_res.json()["tracking_id"], t_id)
        self.assertTrue(len(track_res.json()["logs"]) >= 1)

        # 5. Invalid tracking returns 404
        self.assertEqual(self.client.get("/api/v1/complaints/track/CP-FAKEID99").status_code, 404)


if __name__ == "__main__":
    unittest.main()
