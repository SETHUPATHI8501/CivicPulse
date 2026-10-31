import logging
import uuid
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from models import Complaint, ComplaintLog
from schemas.complaint import ComplaintCreate
from services.ai_classifier import classify_complaint
from services.duplicate_detector import (
    detect_duplicate,
    generate_duplicate_group_id,
)

logger = logging.getLogger("civicpulse.complaint_service")


def generate_unique_tracking_id(db: Session) -> str:
    """
    Generate a collision-resistant unique tracking identifier for citizen complaints.
    Format: CP-<8 UPPERCASE HEX CHARACTERS> (e.g. CP-9F2B81A4)
    """
    while True:
        candidate = f"CP-{uuid.uuid4().hex[:8].upper()}"
        existing = db.execute(
            select(Complaint.id).where(Complaint.tracking_id == candidate)
        ).scalar_one_or_none()
        if not existing:
            return candidate


def create_complaint(db: Session, complaint_in: ComplaintCreate) -> Complaint:
    """
    Service to register a new complaint:
    1. Generates a unique tracking ID.
    2. Runs AI classification (Gemini with automatic fallback to Tamil/English rule-based classifier).
    3. Runs Phase 4 duplicate detection (Haversine distance <= 100m, same category, Jaccard similarity > 0.60).
    4. Assigns or joins duplicate_group_id when matched.
    5. Persists the complaint and updates matched existing complaint transactionally.
    6. Appends an initial SUBMITTED audit log recording classification and duplicate status.
    7. Safely rolls back on any database exception.
    """
    tracking_id = generate_unique_tracking_id(db)

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

            # If matched complaint already belongs to a group, join it
            if matched_complaint.duplicate_group_id:
                duplicate_group_id = matched_complaint.duplicate_group_id
            else:
                # Create a new duplicate group and update the original complaint
                duplicate_group_id = generate_duplicate_group_id()
                matched_complaint.duplicate_group_id = duplicate_group_id
                db.add(matched_complaint)

            duplicate_log_note = (
                f"Duplicate detected: joined group {duplicate_group_id} "
                f"(confidence: {duplicate_confidence * 100:.1f}%, "
                f"distance: {distance:.1f}m, matched complaint #{matched_complaint.id})"
            )
            logger.info("Complaint %s matched as duplicate: %s", tracking_id, duplicate_log_note)
    except Exception as dup_err:
        logger.warning("Duplicate detection encountered an error: %s", dup_err)
        duplicate_group_id = None
        duplicate_confidence = None
        duplicate_log_note = "Duplicate check skipped due to internal error."

    # 3. Create new Complaint model instance
    complaint = Complaint(
        tracking_id=tracking_id,
        citizen_text=complaint_in.citizen_text,
        voice_transcript=complaint_in.voice_transcript,
        category=category,
        priority=priority,
        department=department,
        ai_source=ai_source,
        latitude=complaint_in.latitude,
        longitude=complaint_in.longitude,
        status="OPEN",
        duplicate_group_id=duplicate_group_id,
        duplicate_confidence=duplicate_confidence,
    )

    try:
        db.add(complaint)
        db.flush()  # Flush to populate complaint.id for log foreign key

        # 4. Create initial audit log
        initial_log = ComplaintLog(
            complaint_id=complaint.id,
            actor_name="Citizen",
            actor_role="CITIZEN",
            action="SUBMITTED",
            note=(
                f"Initial complaint registered in system. "
                f"Category: {category}, Priority: {priority}, Dept: {department} "
                f"[{ai_source}: {classification_reason}]. {duplicate_log_note}"
            ),
        )
        db.add(initial_log)
        db.commit()
        db.refresh(complaint)
        return complaint
    except Exception:
        db.rollback()
        raise


def get_complaints(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    category: Optional[str] = None,
) -> Tuple[int, List[Complaint]]:
    """
    Service to retrieve a paginated list of complaints with optional status and category filters.
    Returns (total_count, complaints_list).
    """
    query = select(Complaint).options(selectinload(Complaint.logs))
    count_query = select(func.count(Complaint.id))

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
    Retrieve single complaint by unique tracking ID including its full audit trail.
    """
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.logs))
        .where(Complaint.tracking_id == tracking_id)
    )
    return db.execute(stmt).scalar_one_or_none()
