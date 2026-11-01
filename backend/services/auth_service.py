import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import Officer

# Load .env explicitly from backend root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Environment mode and secret validation
APP_ENV: str = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower().strip()
DEFAULT_SECRET: str = "civicpulse_ai_production_grade_jwt_secret_key_32_bytes_min"
SECRET_KEY: str = os.getenv("SECRET_KEY", DEFAULT_SECRET).strip()

if APP_ENV == "production":
    if not SECRET_KEY or SECRET_KEY == DEFAULT_SECRET or len(SECRET_KEY) < 32:
        raise RuntimeError(
            "In production environment, a secure SECRET_KEY of at least 32 characters must be set in .env."
        )

ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Password hashing with modern Argon2 hasher via pwdlib
password_hasher = PasswordHash((Argon2Hasher(),))

# OAuth2 scheme pointing to token endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


def hash_password(password: str) -> str:
    """Hash plaintext password using Argon2."""
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against stored Argon2 hash."""
    return password_hasher.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generate a signed JWT access token containing subject, role, and expiration claim.
    """
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": now_utc})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    Raises HTTPException 401 on token expiration or invalid signature.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        return payload
    except jwt.PyJWTError:
        raise credentials_exception


def authenticate_officer(
    db: Session,
    email: str,
    password: str,
) -> Optional[Officer]:
    """
    Verify officer/worker/admin email and password against stored database hash.
    Returns Officer if authenticated and active, else None.
    """
    normalized_email = email.strip().lower()
    stmt = select(Officer).where(Officer.email == normalized_email)
    officer = db.execute(stmt).scalar_one_or_none()

    if not officer:
        return None
    if not officer.is_active:
        return None
    if not verify_password(password, officer.hashed_password):
        return None

    return officer


def get_current_officer(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Officer:
    """
    FastAPI dependency to retrieve the currently authenticated Officer/Worker/Admin.
    Verifies JWT token and ensures account is active.
    """
    payload = decode_access_token(token)
    email: str = payload.get("sub")

    stmt = select(Officer).where(Officer.email == email)
    officer = db.execute(stmt).scalar_one_or_none()

    if not officer or not officer.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated account not found or is disabled.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return officer


def get_optional_officer(
    token: Optional[str] = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[Officer]:
    """Optional auth dependency for endpoints that adapt to Citizen vs Officer/Admin."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        email: str = payload.get("sub")
        stmt = select(Officer).where(Officer.email == email)
        officer = db.execute(stmt).scalar_one_or_none()
        if officer and officer.is_active:
            return officer
    except Exception:
        return None
    return None


def require_admin(
    current_officer: Officer = Depends(get_current_officer),
) -> Officer:
    """
    FastAPI dependency enforcing ADMIN role authorization.
    """
    if current_officer.role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required for this action.",
        )
    return current_officer


def require_officer_or_admin(
    current_officer: Officer = Depends(get_current_officer),
) -> Officer:
    """
    FastAPI dependency allowing either OFFICER or ADMIN roles.
    """
    if current_officer.role.upper() not in {"OFFICER", "ADMIN"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authorized municipal officer or administrator credentials required.",
        )
    return current_officer


def require_worker_or_officer_or_admin(
    current_officer: Officer = Depends(get_current_officer),
) -> Officer:
    """
    FastAPI dependency allowing WORKER, OFFICER, or ADMIN roles.
    """
    if current_officer.role.upper() not in {"WORKER", "OFFICER", "ADMIN"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authorized municipal worker, officer, or administrator credentials required.",
        )
    return current_officer
