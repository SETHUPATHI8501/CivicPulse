import os
from pathlib import Path
import pytest
from sqlalchemy import text
from database import SessionLocal, engine, run_migrations

os.environ.setdefault("DISABLE_ONLINE_GEOCODING", "1")

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"


def _list_upload_files():
    if not UPLOADS_DIR.exists():
        return set()
    return {p.resolve() for p in UPLOADS_DIR.rglob("*") if p.is_file() and p.name != ".gitkeep"}


@pytest.fixture(scope="session", autouse=True)
def preserve_production_database():
    """
    Session-level safeguard at backend root that ensures any test records or uploaded files
    created against civicpulse.db during pytest execution (across both scripts/ and tests/)
    are cleanly removed on teardown, and all production complaints and Case ID sequences remain untouched.
    """
    run_migrations(engine)
    db = SessionLocal()
    try:
        max_complaint_id = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM complaints")).scalar() or 0
        max_log_id = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM complaint_logs")).scalar() or 0
        max_officer_id = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM officers")).scalar() or 0
        max_sos_id = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM sos_alerts")).scalar() or 0
        max_sos_log_id = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM sos_logs")).scalar() or 0
        max_notif_id = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM civic_notifications")).scalar() or 0
        existing_sequences = db.execute(
            text("SELECT prefix, year, last_seq FROM case_sequences")
        ).fetchall()
        existing_states = db.execute(
            text(
                "SELECT id, status, duplicate_group_id, duplicate_confidence, "
                "assigned_officer_id, resolution_note, resolution_photo_url, "
                "assigned_worker_id, worker_before_photo_url, worker_after_photo_url, worker_completion_note, "
                "case_id, tracking_id "
                "FROM complaints WHERE id <= :max_id"
            ),
            {"max_id": max_complaint_id},
        ).fetchall()
    finally:
        db.close()

    initial_files = _list_upload_files()

    yield

    # Teardown: remove only test records created during this pytest session
    db = SessionLocal()
    try:
        db.execute(
            text("DELETE FROM sos_logs WHERE id > :max_sl_id OR sos_id > :max_s_id"),
            {"max_sl_id": max_sos_log_id, "max_s_id": max_sos_id},
        )
        db.execute(
            text("DELETE FROM sos_alerts WHERE id > :max_s_id"),
            {"max_s_id": max_sos_id},
        )
        db.execute(
            text("DELETE FROM civic_notifications WHERE id > :max_n_id"),
            {"max_n_id": max_notif_id},
        )
        db.execute(
            text("DELETE FROM complaint_logs WHERE id > :max_log_id OR complaint_id > :max_comp_id"),
            {"max_log_id": max_log_id, "max_comp_id": max_complaint_id},
        )
        db.execute(
            text("DELETE FROM complaints WHERE id > :max_comp_id"),
            {"max_comp_id": max_complaint_id},
        )
        db.execute(
            text("DELETE FROM officers WHERE id > :max_off_id"),
            {"max_off_id": max_officer_id},
        )
        for row in existing_states:
            db.execute(
                text(
                    "UPDATE complaints SET status = :st, duplicate_group_id = :dg, "
                    "duplicate_confidence = :dc, assigned_officer_id = :ao, "
                    "resolution_note = :rn, resolution_photo_url = :rp, "
                    "assigned_worker_id = :aw, worker_before_photo_url = :wb, "
                    "worker_after_photo_url = :wa, worker_completion_note = :wc, "
                    "case_id = :case_val, tracking_id = :trk_val "
                    "WHERE id = :cid"
                ),
                {
                    "st": row[1],
                    "dg": row[2],
                    "dc": row[3],
                    "ao": row[4],
                    "rn": row[5],
                    "rp": row[6],
                    "aw": row[7],
                    "wb": row[8],
                    "wa": row[9],
                    "wc": row[10],
                    "case_val": row[11],
                    "trk_val": row[12],
                    "cid": row[0],
                },
            )
        # Restore case_sequences to pre-test state
        db.execute(text("DELETE FROM case_sequences"))
        for pref, yr, lseq in existing_sequences:
            db.execute(
                text("INSERT INTO case_sequences (prefix, year, last_seq) VALUES (:p, :y, :s)"),
                {"p": pref, "y": yr, "s": lseq},
            )
        db.commit()
    finally:
        db.close()

    # Clean up any temporary test upload files
    after_files = _list_upload_files()
    for new_file in after_files - initial_files:
        try:
            new_file.unlink(missing_ok=True)
        except OSError:
            pass
