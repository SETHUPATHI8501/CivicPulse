import logging
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

logger = logging.getLogger("civicpulse.database")

# Load .env explicitly from the backend directory
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Database URL with default fallback to local SQLite database
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./civicpulse.db")

# SQLite requires check_same_thread=False for multithreaded FastAPI workers
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

# Create SQLAlchemy 2.0 engine
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

# Create SessionLocal factory for generating database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# SQLAlchemy 2.0 DeclarativeBase
class Base(DeclarativeBase):
    pass


def run_migrations(target_engine=None):
    """
    Safe, repeatable, and idempotent database migration:
    1. Backs up the SQLite database file if present on disk before running modifications.
    2. Ensures all tables in Base.metadata (officers, complaints, complaint_logs,
       sos_alerts, sos_logs, civic_notifications, case_sequences) exist.
    3. Dynamically adds missing columns and unique indexes to 'complaints', 'complaint_logs', and 'sos_alerts'.
    4. Backfills missing 'case_id' values using CP-YYYY-NNNNN without modifying existing IDs.
    5. Initializes 'case_sequences' so sequence numbering never resets.
    Preserves all existing records and can be run multiple times safely.
    """
    eng = target_engine or engine

    # 1. SQLite database file backup before migration
    db_name = getattr(eng.url, "database", None)
    if eng.name == "sqlite" and db_name and db_name != ":memory:":
        sqlite_path = Path(db_name)
        if sqlite_path.exists() and sqlite_path.stat().st_size > 0:
            backup_path = sqlite_path.with_suffix(".db.bak")
            try:
                shutil.copyfile(sqlite_path, backup_path)
                logger.info("Database backup created at: %s", backup_path)
            except Exception as bkp_err:
                logger.warning("Could not create database backup: %s", bkp_err)

    # 2. Ensure all tables in metadata exist
    Base.metadata.create_all(bind=eng)

    current_year = datetime.now(timezone.utc).year

    # 3. Dynamic schema migration for SQLite tables
    with eng.connect() as conn:
        # Ensure case_sequences table exists
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS case_sequences ("
                "prefix VARCHAR(20) NOT NULL, "
                "year INTEGER NOT NULL, "
                "last_seq INTEGER NOT NULL DEFAULT 0, "
                "PRIMARY KEY (prefix, year)"
                ");"
            )
        )
        conn.commit()

        # Check complaints table columns
        check_complaints = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='complaints';")
        ).scalar()

        if check_complaints:
            pragma_info = conn.execute(text("PRAGMA table_info(complaints);")).fetchall()
            existing_columns = {row[1] for row in pragma_info}

            if "case_id" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN case_id VARCHAR(50);"))
                conn.commit()

            if "idempotency_key" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN idempotency_key VARCHAR(100);"))
                conn.commit()

            if "is_private" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT 0;"))
                conn.commit()

            if "citizen_token" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN citizen_token VARCHAR(100);"))
                conn.commit()

            if "assigned_officer_id" not in existing_columns:
                conn.execute(
                    text("ALTER TABLE complaints ADD COLUMN assigned_officer_id INTEGER REFERENCES officers(id);")
                )
                conn.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_complaints_assigned_officer_id ON complaints(assigned_officer_id);")
                )
                conn.commit()

            if "resolution_photo_url" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN resolution_photo_url VARCHAR;"))
                conn.commit()

            if "resolution_note" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN resolution_note TEXT;"))
                conn.commit()

            if "address_text" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN address_text VARCHAR(500);"))
                conn.commit()

            if "assigned_worker_id" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN assigned_worker_id INTEGER;"))
                conn.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_complaints_assigned_worker_id ON complaints(assigned_worker_id);")
                )
                conn.commit()

            if "worker_before_photo_url" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN worker_before_photo_url VARCHAR(500);"))
                conn.commit()

            if "worker_after_photo_url" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN worker_after_photo_url VARCHAR(500);"))
                conn.commit()

            if "worker_completion_note" not in existing_columns:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN worker_completion_note TEXT;"))
                conn.commit()

            # Backfill missing case_id values without changing any existing case_id or tracking_id
            missing_rows = conn.execute(
                text("SELECT id, tracking_id, created_at FROM complaints WHERE case_id IS NULL OR case_id = '' ORDER BY id ASC;")
            ).fetchall()
            seq_pattern = re.compile(r"^CP-(\d{4})-(\d+)$", re.IGNORECASE)

            for row_id, trk_id, created_at in missing_rows:
                # If tracking_id is already in CP-YYYY-NNNNN format, reuse it directly
                if trk_id and seq_pattern.match(str(trk_id).strip()):
                    candidate_case_id = str(trk_id).strip().upper()
                else:
                    row_year = current_year
                    if created_at:
                        try:
                            row_year = int(str(created_at)[:4])
                        except Exception:
                            row_year = current_year
                    candidate_case_id = f"CP-{row_year}-{int(row_id):05d}"

                conn.execute(
                    text("UPDATE complaints SET case_id = :cid WHERE id = :rid AND (case_id IS NULL OR case_id = '');"),
                    {"cid": candidate_case_id, "rid": row_id},
                )
            if missing_rows:
                conn.commit()

            # Create unique indexes on case_id and idempotency_key
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_complaints_case_id ON complaints(case_id);")
            )
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_complaints_idempotency_key ON complaints(idempotency_key);")
            )
            conn.commit()

            # Synchronize case_sequences for CP and current_year so sequence never resets
            max_id_val = conn.execute(text("SELECT COALESCE(MAX(id), 0) FROM complaints;")).scalar() or 0
            all_case_ids = conn.execute(
                text("SELECT case_id FROM complaints WHERE case_id LIKE :pat;"),
                {"pat": f"CP-{current_year}-%"},
            ).fetchall()
            max_seq = int(max_id_val)
            for (cid_str,) in all_case_ids:
                if cid_str:
                    m = seq_pattern.match(str(cid_str).strip())
                    if m:
                        max_seq = max(max_seq, int(m.group(2)))

            existing_seq_row = conn.execute(
                text("SELECT last_seq FROM case_sequences WHERE prefix = 'CP' AND year = :yr;"),
                {"yr": current_year},
            ).fetchone()
            if existing_seq_row is None:
                conn.execute(
                    text("INSERT INTO case_sequences (prefix, year, last_seq) VALUES ('CP', :yr, :seq);"),
                    {"yr": current_year, "seq": max_seq},
                )
            elif existing_seq_row[0] < max_seq:
                conn.execute(
                    text("UPDATE case_sequences SET last_seq = :seq WHERE prefix = 'CP' AND year = :yr;"),
                    {"seq": max_seq, "yr": current_year},
                )
            conn.commit()

        # Check sos_alerts table columns
        check_sos = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='sos_alerts';")
        ).scalar()

        if check_sos:
            pragma_sos = conn.execute(text("PRAGMA table_info(sos_alerts);")).fetchall()
            sos_cols = {row[1] for row in pragma_sos}
            if "case_id" not in sos_cols:
                conn.execute(text("ALTER TABLE sos_alerts ADD COLUMN case_id VARCHAR(50);"))
                conn.commit()

            missing_sos = conn.execute(
                text("SELECT id, tracking_id FROM sos_alerts WHERE case_id IS NULL OR case_id = '' ORDER BY id ASC;")
            ).fetchall()
            sos_pattern = re.compile(r"^SOS-(\d{4})-(\d+)$", re.IGNORECASE)
            for s_id, s_trk in missing_sos:
                if s_trk and sos_pattern.match(str(s_trk).strip()):
                    s_cid = str(s_trk).strip().upper()
                else:
                    s_cid = f"SOS-{current_year}-{int(s_id):05d}"
                conn.execute(
                    text("UPDATE sos_alerts SET case_id = :cid WHERE id = :sid AND (case_id IS NULL OR case_id = '');"),
                    {"cid": s_cid, "sid": s_id},
                )
            if missing_sos:
                conn.commit()

            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_sos_alerts_case_id ON sos_alerts(case_id);")
            )
            conn.commit()

            max_sos_id = conn.execute(text("SELECT COALESCE(MAX(id), 0) FROM sos_alerts;")).scalar() or 0
            existing_sos_seq = conn.execute(
                text("SELECT last_seq FROM case_sequences WHERE prefix = 'SOS' AND year = :yr;"),
                {"yr": current_year},
            ).fetchone()
            if existing_sos_seq is None:
                conn.execute(
                    text("INSERT INTO case_sequences (prefix, year, last_seq) VALUES ('SOS', :yr, :seq);"),
                    {"yr": current_year, "seq": int(max_sos_id)},
                )
            conn.commit()

        # Check complaint_logs table columns
        check_logs = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='complaint_logs';")
        ).scalar()

        if check_logs:
            pragma_logs = conn.execute(text("PRAGMA table_info(complaint_logs);")).fetchall()
            log_cols = {row[1] for row in pragma_logs}

            if "old_status" not in log_cols:
                conn.execute(text("ALTER TABLE complaint_logs ADD COLUMN old_status VARCHAR(50);"))
                conn.commit()

            if "new_status" not in log_cols:
                conn.execute(text("ALTER TABLE complaint_logs ADD COLUMN new_status VARCHAR(50);"))
                conn.commit()

            if "officer_id" not in log_cols:
                conn.execute(text("ALTER TABLE complaint_logs ADD COLUMN officer_id INTEGER;"))
                conn.commit()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that opens a database session, yields it to the caller,
    and ensures it is properly closed when the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
