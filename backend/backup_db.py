import datetime
import os
import shutil
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "civicpulse.db"
BACKUP_DIR = BASE_DIR / "backups"


def perform_backup() -> Path:
    """Perform atomic online backup of SQLite database."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"civicpulse_backup_{timestamp}.db"

    # Use native sqlite3 online backup to ensure transactional consistency
    src_conn = sqlite3.connect(str(DB_PATH))
    dst_conn = sqlite3.connect(str(backup_file))

    with dst_conn:
        src_conn.backup(dst_conn, pages=100)

    src_conn.close()
    dst_conn.close()

    print(f"Backup created successfully: {backup_file} ({backup_file.stat().st_size} bytes)")
    return backup_file


def verify_backup_restoration(backup_file: Path) -> bool:
    """Verify backup integrity by verifying record counts on a detached test copy."""
    test_restore_path = BACKUP_DIR / "test_verify_restore.db"
    try:
        shutil.copy2(backup_file, test_restore_path)

        # Connect to restored copy
        conn = sqlite3.connect(str(test_restore_path))
        cursor = conn.cursor()

        # Query counts
        c_count = cursor.execute("SELECT count(*) FROM complaints").fetchone()[0]
        o_count = cursor.execute("SELECT count(*) FROM officers").fetchone()[0]
        l_count = cursor.execute("SELECT count(*) FROM complaint_logs").fetchone()[0]
        conn.close()

        print(f"Restoration Verification on {test_restore_path.name}:")
        print(f"  Complaints: {c_count}")
        print(f"  Officers: {o_count}")
        print(f"  Complaint Logs: {l_count}")

        assert c_count > 0, "No complaints found in backup"
        assert o_count > 0, "No officers found in backup"
        assert l_count > 0, "No logs found in backup"
        print("Restoration integrity verification PASSED.")
        return True
    finally:
        if test_restore_path.exists():
            test_restore_path.unlink()


if __name__ == "__main__":
    backup_path = perform_backup()
    verify_backup_restoration(backup_path)

