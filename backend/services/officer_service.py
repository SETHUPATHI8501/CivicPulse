import uuid
from pathlib import Path
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from models import Complaint, ComplaintLog, Officer
from schemas.auth import OfficerCreate
from services.auth_service import hash_password

# Allowed status transitions as specified in Phase 5:
# Direct transition to RESOLVED via /status is forbidden; officers must use /resolve
ALLOWED_TRANSITIONS = {
    "OPEN": {"IN_PROGRESS", "NEEDS_INFO", "REJECTED"},
    "IN_PROGRESS": {"NEEDS_INFO"},
    "NEEDS_INFO": {"OPEN", "IN_PROGRESS", "REJECTED"},
}

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def create_officer(db: Session, officer_in: OfficerCreate) -> Officer:
    """
    Create a new officer account with hashed Argon2 password.
    Enforces unique email check.
    """
    normalized_email = officer_in.email.strip().lower()
    existing = db.execute(
        select(Officer.id).where(Officer.email == normalized_email)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An officer account with email '{normalized_email}' already exists.",
        )

    officer = Officer(
        name=officer_in.name.strip(),
        email=normalized_email,
        hashed_password=hash_password(officer_in.password),
        department=officer_in.department.strip(),
        role=officer_in.role.strip().upper(),
        is_active=True,
    )
    try:
        db.add(officer)
        db.commit()
        db.refresh(officer)
        return officer
    except Exception:
        db.rollback()
        raise


def list_officers(db: Session, department: Optional[str] = None) -> List[Officer]:
    """List officers with optional department filter."""
    stmt = select(Officer)
    if department:
        stmt = stmt.where(Officer.department == department.strip())
    return list(db.execute(stmt.order_by(Officer.name.asc())).scalars().all())


def get_officer_by_id(db: Session, officer_id: int) -> Optional[Officer]:
    """Retrieve officer by database ID."""
    stmt = select(Officer).where(Officer.id == officer_id)
    return db.execute(stmt).scalar_one_or_none()


def assign_complaint(
    db: Session,
    complaint_id: int,
    officer_id: int,
    assigned_by_name: str,
    note: Optional[str] = None,
) -> Complaint:
    """
    Assign an existing complaint to an active officer:
    1. Validates complaint and officer exist.
    2. Validates officer is active.
    3. Verifies officer's department matches complaint's department.
    4. Updates assigned_officer_id.
    5. Appends an ASSIGNED audit log entry.
    """
    complaint = db.execute(
        select(Complaint)
        .options(selectinload(Complaint.logs))
        .where(Complaint.id == complaint_id)
    ).scalar_one_or_none()

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID {complaint_id} not found.",
        )

    officer = get_officer_by_id(db, officer_id)
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Officer with ID {officer_id} not found.",
        )

    if not officer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign complaint to inactive officer '{officer.name}'.",
        )

    # Department compatibility check (ADMIN officers or exact department match allowed)
    if officer.role.upper() != "ADMIN" and officer.department != complaint.department:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Department mismatch: complaint department is '{complaint.department}', "
                f"but officer '{officer.name}' belongs to '{officer.department}'."
            ),
        )

    complaint.assigned_officer_id = officer.id

    # Append assignment audit log
    assignment_log = ComplaintLog(
        complaint_id=complaint.id,
        actor_name=assigned_by_name,
        actor_role="ADMIN",
        action="ASSIGNED",
        note=note or f"Complaint assigned to officer {officer.name} ({officer.department}).",
    )
    try:
        db.add(assignment_log)
        db.commit()
        db.refresh(complaint)
        return complaint
    except Exception:
        db.rollback()
        raise


def get_officer_complaints(
    db: Session,
    current_officer: Officer,
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    category: Optional[str] = None,
) -> Tuple[int, List[Complaint]]:
    """
    Retrieve complaints queue for officers:
    - ADMIN can view all complaints.
    - Regular OFFICER can view only complaints assigned to them.
    Supports status/category filtering and pagination.
    """
    query = select(Complaint).options(selectinload(Complaint.logs))
    count_query = select(func.count(Complaint.id))

    # Role-based visibility
    if current_officer.role.upper() != "ADMIN":
        query = query.where(Complaint.assigned_officer_id == current_officer.id)
        count_query = count_query.where(Complaint.assigned_officer_id == current_officer.id)

    if status:
        query = query.where(Complaint.status == status)
        count_query = count_query.where(Complaint.status == status)

    if category:
        query = query.where(Complaint.category == category)
        count_query = count_query.where(Complaint.category == category)

    total = db.execute(count_query).scalar_one()
    items = (
        db.execute(
            query.order_by(Complaint.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    return total, list(items)


def update_complaint_status(
    db: Session,
    complaint_id: int,
    new_status: str,
    current_officer: Officer,
    note: Optional[str] = None,
    resolution_note: Optional[str] = None,
    resolution_photo_url: Optional[str] = None,
) -> Complaint:
    """
    Update complaint status following strictly allowed state machine transitions:
    - OPEN -> IN_PROGRESS, NEEDS_INFO, REJECTED
    - IN_PROGRESS -> RESOLVED, NEEDS_INFO
    - NEEDS_INFO -> OPEN, IN_PROGRESS, REJECTED
    Enforces authorization: only assigned officer or ADMIN can update.
    """
    complaint = db.execute(
        select(Complaint)
        .options(selectinload(Complaint.logs))
        .where(Complaint.id == complaint_id)
    ).scalar_one_or_none()

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID {complaint_id} not found.",
        )

    # Permission check: assigned officer or ADMIN
    if current_officer.role.upper() != "ADMIN" and complaint.assigned_officer_id != current_officer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update status for complaints not assigned to you.",
        )

    old_status = complaint.status.upper()
    target_status = new_status.upper()

    # The status endpoint must not allow setting status to RESOLVED
    if target_status == "RESOLVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Direct transition to RESOLVED is prohibited via status endpoint. Use the dedicated /resolve endpoint with resolution photo and note.",
        )

    # Validate transition
    allowed = ALLOWED_TRANSITIONS.get(old_status, set())
    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status transition from '{old_status}' to '{target_status}'. "
                f"Allowed transitions: {sorted(list(allowed))}"
            ),
        )

    complaint.status = target_status

    if resolution_note:
        complaint.resolution_note = resolution_note
    if resolution_photo_url:
        complaint.resolution_photo_url = resolution_photo_url

    # Append audit log
    status_log = ComplaintLog(
        complaint_id=complaint.id,
        actor_name=current_officer.name,
        actor_role=current_officer.role,
        action=f"STATUS_{target_status}",
        old_status=old_status,
        new_status=target_status,
        officer_id=current_officer.id,
        note=note or f"Status changed from {old_status} to {target_status}.",
    )

    try:
        db.add(status_log)
        db.commit()
        db.refresh(complaint)
        return complaint
    except Exception:
        db.rollback()
        raise


def validate_image_bytes(content: bytes, filename: str, content_type: Optional[str] = None) -> str:
    """
    Validate that uploaded file is a valid image within 5 MB:
    - Rejects empty bytes
    - Rejects bytes > 5 MB
    - Rejects invalid extensions
    - Rejects invalid MIME types
    - Validates magic header bytes for JPEG, PNG, WEBP
    Returns the normalized extension (e.g. '.jpg', '.png', '.webp')
    """
    if not content or len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resolution photo cannot be empty.",
        )

    if len(content) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Resolution photo size ({len(content)} bytes) exceeds 5 MB maximum limit.",
        )

    ext = Path(filename).suffix.lower() if filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension '{ext}'. Supported image formats: .jpg, .jpeg, .png, .webp.",
        )

    if content_type:
        clean_mime = content_type.lower().split(";")[0].strip()
        if clean_mime not in ALLOWED_IMAGE_MIMES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Content-Type '{content_type}'. Supported image MIME types: {sorted(list(ALLOWED_IMAGE_MIMES))}.",
            )

    # Magic signature check
    is_jpeg = content.startswith(b"\xff\xd8\xff")
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"

    if not (is_jpeg or is_png or is_webp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match a valid image signature (JPEG, PNG, WEBP).",
        )

    return ext if ext != ".jpeg" else ".jpg"


def resolve_complaint(
    db: Session,
    complaint_id: int,
    current_officer: Officer,
    resolution_note: str,
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> Complaint:
    """
    Dedicated complaint resolution workflow:
    1. Authenticates officer and verifies complaint exists.
    2. Verifies officer is assigned to complaint (unless ADMIN).
    3. Verifies current complaint status is IN_PROGRESS.
    4. Validates non-empty resolution note.
    5. Validates image file type, magic header bytes, and <= 5 MB size limit.
    6. Generates safe unique filename and saves to uploads/resolutions.
    7. Sets status = RESOLVED, saves photo URL and resolution note.
    8. Records audit log entry in ComplaintLog:
       - action: RESOLVED
       - old_status: IN_PROGRESS
       - new_status: RESOLVED
       - officer_id: officer.id
       - note: resolution_note
    9. Transactional rollback and file deletion on database commit failure.
    """
    complaint = db.execute(
        select(Complaint)
        .options(selectinload(Complaint.logs))
        .where(Complaint.id == complaint_id)
    ).scalar_one_or_none()

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID {complaint_id} not found.",
        )

    # 1. Permission check: assigned officer or ADMIN
    if current_officer.role.upper() != "ADMIN" and complaint.assigned_officer_id != current_officer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to resolve complaints not assigned to you.",
        )

    # 2. Allow resolution only from IN_PROGRESS status
    if complaint.status.upper() != "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resolve complaint with status '{complaint.status}'. Complaint status must be IN_PROGRESS.",
        )

    # 3. Require a non-empty resolution note
    trimmed_note = resolution_note.strip() if resolution_note else ""
    if not trimmed_note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resolution note cannot be empty or solely whitespace.",
        )

    # 4. Require valid image and reject > 5 MB
    ext = validate_image_bytes(file_bytes, filename=filename, content_type=content_type)

    # 5. Generate safe unique filename
    unique_filename = f"res_{complaint_id}_{uuid.uuid4().hex[:12]}{ext}"
    resolutions_dir = Path(__file__).resolve().parent.parent / "uploads" / "resolutions"
    resolutions_dir.mkdir(parents=True, exist_ok=True)
    file_path = resolutions_dir / unique_filename

    old_status = complaint.status.upper()

    # 6. Database transaction with guaranteed file cleanup on failure
    try:
        file_path.write_bytes(file_bytes)

        complaint.status = "RESOLVED"
        complaint.resolution_photo_url = f"/uploads/resolutions/{unique_filename}"
        complaint.resolution_note = trimmed_note

        resolution_log = ComplaintLog(
            complaint_id=complaint.id,
            actor_name=current_officer.name,
            actor_role=current_officer.role,
            action="RESOLVED",
            old_status=old_status,
            new_status="RESOLVED",
            officer_id=current_officer.id,
            note=trimmed_note,
        )

        db.add(resolution_log)
        db.commit()
        db.refresh(complaint)
        return complaint
    except Exception as exc:
        db.rollback()
        if file_path.exists():
            try:
                file_path.unlink()
            except OSError:
                pass
        raise exc

