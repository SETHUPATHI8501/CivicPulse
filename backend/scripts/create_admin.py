import getpass
import os
import sys
from pathlib import Path

# Add backend directory to sys.path so imports work regardless of cwd
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from database import SessionLocal, run_migrations
from models import Officer
from services.auth_service import hash_password


def setup_admin():
    """
    Secure initial administrator setup:
    1. Reads admin name, email, and password from environment variables or secure prompts.
    2. Runs migrations to ensure database tables are present.
    3. Hashes password using Argon2.
    4. Prevents duplicate admin creation.
    5. Confirms creation without logging or printing passwords.
    """
    print("=== CivicPulse AI - Administrator Setup ===")

    # Read from environment variables if set, otherwise prompt securely
    name = os.getenv("ADMIN_NAME", "").strip()
    email = os.getenv("ADMIN_EMAIL", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "")

    if not name:
        name = input("Enter Admin Full Name: ").strip()
    if not email:
        email = input("Enter Admin Email: ").strip().lower()
    if not password:
        password = getpass.getpass("Enter Admin Password (min 6 characters): ")

    if not name or not email or len(password) < 6:
        print("Error: Name, valid email, and a password with at least 6 characters are required.")
        sys.exit(1)

    email = email.lower()

    # Ensure database schema is migrated
    run_migrations()

    db = SessionLocal()
    try:
        existing = db.query(Officer).filter(Officer.email == email).first()
        if existing:
            if existing.role.upper() == "ADMIN":
                print(f"Info: Administrator account '{email}' already exists. No duplicate created.")
            else:
                print(f"Error: An officer account with email '{email}' already exists with role '{existing.role}'.")
            return

        admin_officer = Officer(
            name=name,
            email=email,
            hashed_password=hash_password(password),
            department="Administration",
            role="ADMIN",
            is_active=True,
        )
        db.add(admin_officer)
        db.commit()
        db.refresh(admin_officer)
        print(f"Success: Administrator account '{email}' (ID: {admin_officer.id}) created successfully.")
    except Exception as exc:
        db.rollback()
        print(f"Database error during admin setup: {exc}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    setup_admin()

