import logging
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session, selectinload

from models import CaseSequence, CivicNotification, Complaint, ComplaintLog, SOSAlert
from schemas.complaint import ComplaintCreate
from services.ai_classifier import classify_complaint
from services.duplicate_detector import (
    detect_duplicate,
    generate_duplicate_group_id,
)
from services.geo_utils import haversine_distance

logger = logging.getLogger("civicpulse.complaint_service")

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
CITIZEN_UPLOADS_DIR = UPLOADS_DIR / "complaints"

ALLOWED_CITIZEN_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CITIZEN_PHOTO_MIMES = {"image/jpeg", "image/png", "image/webp"}
MAX_CITIZEN_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB

# Process-wide lock to serialize Case ID sequence allocation across concurrent threads
_CASE_SEQ_LOCK = threading.Lock()

# Fast offline landmark index for automatic address enrichment during complaint creation
_LOCAL_HUBS = [
    ("Tiruchengode Municipal Bus Stand, Namakkal", 11.3802, 77.8944),
    ("KSR Kalvi Nagar, Tiruchengode", 11.3635, 77.8282),
    ("Erode Central Junction, Erode", 11.3410, 77.7172),
    ("Namakkal Fort Main Road, Namakkal", 11.2189, 78.1674),
    ("Salem Five Roads Junction, Salem", 11.6643, 78.1460),
    ("Gandhipuram Town Hall, Coimbatore", 11.0168, 76.9558),
    ("Karur Bus Stand Circle, Karur", 10.9601, 78.0766),
]


def _resolve_fast_address(lat: float, lon: float) -> str:
    best_name = _LOCAL_HUBS[0][0]
    min_d = float("inf")
    for name, hlat, hlon in _LOCAL_HUBS:
        d = haversine_distance(lat, lon, hlat, hlon)
        if d < min_d:
            min_d = d
            best_name = name
    if min_d <= 500:
        return f"Near {best_name}"
    return f"{round(min_d / 1000.0, 2)} km from {best_name} ({lat:.4f}°N, {lon:.4f}°E)"


def save_citizen_photo(file_bytes: bytes, filename: str, content_type: Optional[str] = None) -> str:
    """
    Validate and save citizen-uploaded photo:
    - Checks file extension (.jpg, .jpeg, .png, .webp)
    - Validates MIME type if provided
    - Enforces max size 5 MB
    - Generates unique safe filename
    - Saves into uploads/complaints/
    - Returns accessible URL path
    """
    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded photo cannot be empty.",
        )

    if len(file_bytes) > MAX_CITIZEN_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded photo exceeds maximum allowed size of 5 MB.",
        )

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_CITIZEN_PHOTO_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image extension '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_CITIZEN_PHOTO_EXTS))}",
        )

    if content_type and content_type.lower() not in ALLOWED_CITIZEN_PHOTO_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image MIME type '{content_type}'.",
        )

    CITIZEN_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    ts = int(datetime.now(timezone.utc).timestamp())
    safe_name = f"comp_{uuid.uuid4().hex[:12]}_{ts}{ext}"
    dest_path = CITIZEN_UPLOADS_DIR / safe_name

    try:
        dest_path.write_bytes(file_bytes)
    except Exception as exc:
        logger.error("Failed to write citizen photo to disk: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist uploaded photo.",
        )

    return f"/uploads/complaints/{safe_name}"


def generate_unique_case_id(db: Session, prefix: str = "CP") -> str:
    """
    Generate a unique, sequential Case ID on the backend.
    Format:
      - Citizen Complaints: CP-YYYY-NNNNN (e.g. CP-2026-00094)
      - SOS Emergencies:    SOS-YYYY-NNNNN (e.g. SOS-2026-00001)
    Guarantees:
      - Uses actual current UTC year dynamically.
      - Thread-safe and database-safe atomic increment via `case_sequences`.
      - Never resets existing sequence numbers.
      - Verifies no collision against existing `case_id` or `tracking_id`.
    """
    clean_prefix = prefix.strip().upper()
    current_year = datetime.now(timezone.utc).year
    seq_regex = re.compile(rf"^{re.escape(clean_prefix)}-{current_year}-(\d+)$", re.IGNORECASE)

    with _CASE_SEQ_LOCK:
        # Ensure case_sequences table exists even if called on a fresh session
        db.execute(
            text(
                "CREATE TABLE IF NOT EXISTS case_sequences ("
                "prefix VARCHAR(20) NOT NULL, "
                "year INTEGER NOT NULL, "
                "last_seq INTEGER NOT NULL DEFAULT 0, "
                "PRIMARY KEY (prefix, year)"
                ");"
            )
        )

        # Determine highest existing sequence in database tables
        if clean_prefix == "SOS":
            max_table_id = db.execute(select(func.coalesce(func.max(SOSAlert.id), 0))).scalar_one() or 0
            existing_ids = db.execute(
                select(SOSAlert.case_id, SOSAlert.tracking_id).where(
                    or_(
                        SOSAlert.case_id.like(f"SOS-{current_year}-%"),
                        SOSAlert.tracking_id.like(f"SOS-{current_year}-%"),
                    )
                )
            ).all()
        else:
            max_table_id = db.execute(select(func.coalesce(func.max(Complaint.id), 0))).scalar_one() or 0
            existing_ids = db.execute(
                select(Complaint.case_id, Complaint.tracking_id).where(
                    or_(
                        Complaint.case_id.like(f"CP-{current_year}-%"),
                        Complaint.tracking_id.like(f"CP-{current_year}-%"),
                    )
                )
            ).all()

        max_observed_seq = int(max_table_id)
        for cid_val, trk_val in existing_ids:
            for val in (cid_val, trk_val):
                if val:
                    m = seq_regex.match(str(val).strip())
                    if m:
                        max_observed_seq = max(max_observed_seq, int(m.group(1)))

        seq_row = db.execute(
            select(CaseSequence).where(
                CaseSequence.prefix == clean_prefix,
                CaseSequence.year == current_year,
            )
        ).scalar_one_or_none()

        if seq_row is None:
            next_seq = max_observed_seq + 1
            seq_row = CaseSequence(prefix=clean_prefix, year=current_year, last_seq=next_seq)
            db.add(seq_row)
            db.flush()
        else:
            next_seq = max(int(seq_row.last_seq), max_observed_seq) + 1
            seq_row.last_seq = next_seq
            db.add(seq_row)
            db.flush()

        # Verify no collision in target table
        while True:
            candidate = f"{clean_prefix}-{current_year}-{next_seq:05d}"
            if clean_prefix == "SOS":
                collision = db.execute(
                    select(SOSAlert.id).where(
                        or_(SOSAlert.case_id == candidate, SOSAlert.tracking_id == candidate)
                    )
                ).scalar_one_or_none()
            else:
                collision = db.execute(
                    select(Complaint.id).where(
                        or_(Complaint.case_id == candidate, Complaint.tracking_id == candidate)
                    )
                ).scalar_one_or_none()

            if not collision:
                seq_row.last_seq = next_seq
                db.flush()
                return candidate

            next_seq += 1


def generate_unique_tracking_id(db: Session) -> str:
    """
    Backward-compatible alias that generates a unified sequential Case ID (CP-YYYY-NNNNN).
    """
    return generate_unique_case_id(db=db, prefix="CP")


def create_complaint(
    db: Session,
    complaint_in: ComplaintCreate,
    photo_url: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Complaint:
    """
    Service to register a new complaint:
    1. Checks idempotency_key to prevent duplicate records on network retries.
    2. Generates a unique sequential Case ID (CP-YYYY-NNNNN).
    3. Runs AI classification (Gemini with automatic fallback to Tamil/English rule-based classifier).
    4. Runs Phase 4 duplicate detection (Haversine distance <= 100m, same category, Jaccard similarity > 0.60).
    5. Assigns or joins duplicate_group_id when matched.
    6. Persists the complaint and updates matched existing complaint transactionally.
    7. Appends an initial SUBMITTED audit log recording Case ID, classification, and duplicate status.
    8. Creates real-time CivicNotifications (for both Citizen and Staff) containing the Case ID.
    """
    idem_key = (idempotency_key or getattr(complaint_in, "idempotency_key", None) or "").strip() or None
    if idem_key:
        existing_idem = db.execute(
            select(Complaint)
            .options(selectinload(Complaint.logs))
            .where(Complaint.idempotency_key == idem_key)
        ).scalar_one_or_none()
        if existing_idem:
            return existing_idem

    # 1. Execute classification pipeline (Gemini AI -> Rule-based fallback)
    classification = classify_complaint(
        citizen_text=complaint_in.citizen_text,
        voice_transcript=complaint_in.voice_transcript,
    )

    category = classification.get("category", "Other")
    priority = classification.get("priority", "MEDIUM")
    department = classification.get("department", "General")
    ai_source = classification.get("ai_source", "RULE_BASED_FALLBACK")
    classification_reason = classification.get("reason", "Classified")

    # 2. Run Duplicate Detection (safely caught so errors never block submission)
    duplicate_group_id: Optional[str] = None
    duplicate_confidence: Optional[float] = None
    duplicate_log_note = "No duplicate detected."

    try:
        matched = detect_duplicate(
            latitude=complaint_in.latitude,
            longitude=complaint_in.longitude,
            category=category,
            text=complaint_in.citizen_text,
            db=db,
        )

        if matched:
            matched_complaint, similarity, distance = matched
            duplicate_confidence = round(similarity, 4)

            if matched_complaint.duplicate_group_id:
                duplicate_group_id = matched_complaint.duplicate_group_id
            else:
                duplicate_group_id = generate_duplicate_group_id()
                matched_complaint.duplicate_group_id = duplicate_group_id
                db.add(matched_complaint)

            matched_cid = matched_complaint.case_id or matched_complaint.tracking_id
            duplicate_log_note = (
                f"Duplicate detected: joined group {duplicate_group_id} "
                f"(confidence: {duplicate_confidence * 100:.1f}%, "
                f"distance: {distance:.1f}m, matched Case {matched_cid})"
            )
    except Exception as dup_err:
        logger.warning("Duplicate detection encountered an error: %s", dup_err)
        duplicate_group_id = None
        duplicate_confidence = None
        duplicate_log_note = "Duplicate check skipped due to internal error."

    resolved_address = complaint_in.address_text or _resolve_fast_address(
        complaint_in.latitude, complaint_in.longitude
    )

    is_priv = bool(getattr(complaint_in, "is_private", False))
    cit_token = f"CT-{uuid.uuid4().hex[:16].upper()}" if is_priv else None

    try:
        # 3. Allocate unique sequential Case ID (CP-YYYY-NNNNN) inside lock
        case_id = generate_unique_case_id(db=db, prefix="CP")

        complaint = Complaint(
            case_id=case_id,
            tracking_id=case_id,
            idempotency_key=idem_key,
            is_private=is_priv,
            citizen_token=cit_token,
            citizen_text=complaint_in.citizen_text,
            voice_transcript=complaint_in.voice_transcript,
            category=category,
            priority=priority,
            department=department,
            ai_source=ai_source,
            latitude=complaint_in.latitude,
            longitude=complaint_in.longitude,
            address_text=resolved_address,
            photo_url=photo_url,
            status="OPEN",
            duplicate_group_id=duplicate_group_id,
            duplicate_confidence=duplicate_confidence,
        )
        db.add(complaint)
        db.flush()

        # 4. Create initial audit log
        photo_note = f" Photo attached: {photo_url}." if photo_url else ""
        initial_log = ComplaintLog(
            complaint_id=complaint.id,
            actor_name="Citizen",
            actor_role="CITIZEN",
            action="SUBMITTED",
            note=(
                f"Complaint {case_id} registered in system. "
                f"Category: {category}, Priority: {priority}, Dept: {department} "
                f"[{ai_source}: {classification_reason}]. {duplicate_log_note}{photo_note}"
            ),
        )
        db.add(initial_log)

        # 5. Create notifications including the Case ID for Citizen and Staff
        try:
            staff_notif = CivicNotification(
                recipient_role="ALL_STAFF",
                tracking_id=case_id,
                event_type="COMPLAINT_SUBMITTED",
                title=f"New {priority} {category} Complaint ({case_id})",
                message=f"Case {case_id} submitted for {department}: {complaint_in.citizen_text[:120]} at {resolved_address}",
                is_read=False,
            )
            citizen_notif = CivicNotification(
                recipient_role="CITIZEN",
                tracking_id=case_id,
                event_type="COMPLAINT_SUBMITTED",
                title=f"Complaint Submitted: {case_id}",
                message=f"Your complaint {case_id} has been registered under {category} ({department}) with {priority} priority.",
                is_read=False,
            )
            db.add(staff_notif)
            db.add(citizen_notif)
        except Exception:
            pass

        db.commit()
        db.refresh(complaint)
        return complaint
    except Exception:
        db.rollback()
        raise


def get_public_stats(db: Session) -> Dict:
    """
    Compute real aggregated public statistics from the database.
    Used by citizen landing page and mobile dashboard.
    """
    total = db.execute(select(func.count(Complaint.id))).scalar_one() or 0
    open_count = (
        db.execute(
            select(func.count(Complaint.id)).where(Complaint.status == "OPEN")
        ).scalar_one()
        or 0
    )
    in_progress_count = (
        db.execute(
            select(func.count(Complaint.id)).where(Complaint.status == "IN_PROGRESS")
        ).scalar_one()
        or 0
    )
    resolved_count = (
        db.execute(
            select(func.count(Complaint.id)).where(Complaint.status == "RESOLVED")
        ).scalar_one()
        or 0
    )
    high_priority_count = (
        db.execute(
            select(func.count(Complaint.id)).where(
                func.upper(Complaint.priority) == "HIGH"
            )
        ).scalar_one()
        or 0
    )

    cat_rows = db.execute(
        select(Complaint.category, func.count(Complaint.id)).group_by(Complaint.category)
    ).all()
    category_distribution = {cat: count for cat, count in cat_rows}
    resolution_rate_pct = round((resolved_count / total) * 100, 1) if total > 0 else 0.0

    return {
        "total_complaints": total,
        "open_complaints": open_count,
        "in_progress_complaints": in_progress_count,
        "resolved_complaints": resolved_count,
        "high_priority_complaints": high_priority_count,
        "resolution_rate_pct": resolution_rate_pct,
        "category_distribution": category_distribution,
    }


def get_complaints(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    category: Optional[str] = None,
    case_id: Optional[str] = None,
    include_private: bool = False,
) -> Tuple[int, List[Complaint]]:
    """
    Service to retrieve a paginated list of complaints with optional status, category, and case_id filters.
    Excludes private citizen complaints from public listing unless include_private=True.
    """
    query = select(Complaint).options(selectinload(Complaint.logs))
    count_query = select(func.count(Complaint.id))

    if not include_private:
        query = query.where(or_(Complaint.is_private == False, Complaint.is_private.is_(None)))
        count_query = count_query.where(or_(Complaint.is_private == False, Complaint.is_private.is_(None)))

    if status:
        query = query.where(Complaint.status == status)
        count_query = count_query.where(Complaint.status == status)

    if category:
        query = query.where(Complaint.category == category)
        count_query = count_query.where(Complaint.category == category)

    if case_id and case_id.strip():
        q_clean = f"%{case_id.strip().upper()}%"
        cond = or_(
            func.upper(Complaint.case_id).like(q_clean),
            func.upper(Complaint.tracking_id).like(q_clean),
        )
        query = query.where(cond)
        count_query = count_query.where(cond)

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


def get_complaint_by_id(db: Session, complaint_id: int) -> Optional[Complaint]:
    """
    Retrieve single complaint by database ID including its full audit trail.
    """
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.logs))
        .where(Complaint.id == complaint_id)
    )
    return db.execute(stmt).scalar_one_or_none()


def get_complaint_by_tracking_id(db: Session, tracking_id: str) -> Optional[Complaint]:
    """
    Retrieve single complaint by Unified Case ID (e.g. CP-2026-00093) or legacy tracking_id (e.g. CP-B7C97719).
    """
    clean_id = (tracking_id or "").strip().upper()
    if not clean_id:
        return None
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.logs))
        .where(
            or_(
                func.upper(Complaint.case_id) == clean_id,
                func.upper(Complaint.tracking_id) == clean_id,
            )
        )
    )
    return db.execute(stmt).scalar_one_or_none()
