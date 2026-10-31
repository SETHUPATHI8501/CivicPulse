import logging
import os
import shutil
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
    2. Ensures all tables in Base.metadata (officers, complaints, complaint_logs) exist.
    3. Checks and dynamically adds missing columns to 'complaints':
       - 'assigned_officer_id'
       - 'resolution_photo_url'
       - 'resolution_note'
    4. Checks and dynamically adds missing columns to 'complaint_logs':
       - 'old_status'
       - 'new_status'
       - 'officer_id'
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

    # 3. Dynamic schema migration for SQLite tables
    with eng.connect() as conn:
        # Check complaints table columns
        check_complaints = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='complaints';")
        ).scalar()

        if check_complaints:
            pragma_info = conn.execute(text("PRAGMA table_info(complaints);")).fetchall()
            existing_columns = {row[1] for row in pragma_info}

            if "assigned_officer_id" not in existing_columns:
                logger.info("Migrating database: adding 'assigned_officer_id' to complaints table...")
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
