from typing import Optional
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Path, Query, UploadFile, status
from sqlalchemy.orm import Session

from database import get_db
from models import Officer
from schemas.complaint import (
    ComplaintCreate,
    ComplaintListResponse,
    ComplaintResponse,
    PublicStatsResponse,
)
from services import advanced_service, complaint_service
from services.auth_service import get_optional_officer

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.post(
    "",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new citizen complaint (JSON)",
)
async def create_complaint(
    complaint_in: ComplaintCreate,
    x_idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
    db: Session = Depends(get_db),
):
    """
    Register a new citizen complaint using JSON payload:
    - Validates text and coordinate bounds.
    - Generates a unique sequential Case ID (e.g. CP-2026-00094).
    - Supports idempotent retries via X-Idempotency-Key or idempotency_key.
    - Executes AI classification (Gemini + fallback).
    - Executes geospatial duplicate detection.
    - Broadcasts real-time WebSocket event to Web and Mobile clients.
    """
    comp = complaint_service.create_complaint(
        db=db,
        complaint_in=complaint_in,
        idempotency_key=x_idempotency_key or complaint_in.idempotency_key,
    )
    await advanced_service.broadcaster.broadcast(
        {
            "event": "COMPLAINT_CREATED",
            "id": comp.id,
            "case_id": comp.case_id or comp.tracking_id,
            "tracking_id": comp.tracking_id,
            "category": comp.category,
            "priority": comp.priority,
            "department": comp.department,
            "status": comp.status,
            "latitude": comp.latitude,
            "longitude": comp.longitude,
            "address_text": comp.address_text,
            "created_at": str(comp.created_at),
        }
    )
    return comp


@router.post(
    "/with-photo",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new citizen complaint with optional photo (Multipart)",
)
async def create_complaint_with_photo(
    citizen_text: str = Form(..., description="Detailed description of civic issue"),
    latitude: float = Form(..., ge=-90.0, le=90.0, description="GPS Latitude (-90 to 90)"),
    longitude: float = Form(..., ge=-180.0, le=180.0, description="GPS Longitude (-180 to 180)"),
    voice_transcript: Optional[str] = Form(None, description="Optional voice transcript"),
    address_text: Optional[str] = Form(None, description="Optional reverse-geocoded address"),
    idempotency_key: Optional[str] = Form(None, description="Optional idempotency key"),
    is_private: bool = Form(False, description="Optional private complaint flag"),
    photo: Optional[UploadFile] = File(None, description="Optional issue photo (JPEG/PNG/WEBP, < 5 MB)"),
    x_idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
    db: Session = Depends(get_db),
):
    """
    Register a new citizen complaint supporting multipart/form-data with optional photo:
    - Generates a unique sequential Case ID (CP-YYYY-NNNNN).
    - Validates file format and size if photo is attached.
    - Triggers AI classification, duplicate detection, and WebSocket broadcast.
    """
    photo_url: Optional[str] = None
    if photo and photo.filename:
        file_bytes = await photo.read()
        if len(file_bytes) > 0:
            photo_url = complaint_service.save_citizen_photo(
                file_bytes=file_bytes,
                filename=photo.filename,
                content_type=photo.content_type,
            )

    complaint_in = ComplaintCreate(
        citizen_text=citizen_text,
        voice_transcript=voice_transcript,
        latitude=latitude,
        longitude=longitude,
        address_text=address_text,
        idempotency_key=x_idempotency_key or idempotency_key,
        is_private=is_private,
    )

    comp = complaint_service.create_complaint(
        db=db,
        complaint_in=complaint_in,
        photo_url=photo_url,
        idempotency_key=x_idempotency_key or idempotency_key,
    )
    await advanced_service.broadcaster.broadcast(
        {
            "event": "COMPLAINT_CREATED",
            "id": comp.id,
            "case_id": comp.case_id or comp.tracking_id,
            "tracking_id": comp.tracking_id,
            "category": comp.category,
            "priority": comp.priority,
            "department": comp.department,
            "status": comp.status,
            "latitude": comp.latitude,
            "longitude": comp.longitude,
            "address_text": comp.address_text,
            "created_at": str(comp.created_at),
        }
    )
    return comp


@router.get(
    "/public-stats",
    response_model=PublicStatsResponse,
    summary="Get aggregated public complaint statistics",
)
def get_public_statistics(
    db: Session = Depends(get_db),
):
    """
    Retrieve real database aggregate statistics for citizen home page and mobile dashboard.
    """
    return complaint_service.get_public_stats(db=db)


@router.get(
    "",
    response_model=ComplaintListResponse,
    summary="List complaints with pagination, status, category, and Case ID search",
)
def list_complaints(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max number of records to return"),
    status: Optional[str] = Query(None, description="Filter by complaint status (e.g. OPEN, RESOLVED)"),
    category: Optional[str] = Query(None, description="Filter by category (e.g. Other, Roads)"),
    case_id: Optional[str] = Query(None, description="Search by Case ID (e.g. CP-2026-00093)"),
    current_user: Optional[Officer] = Depends(get_optional_officer),
    db: Session = Depends(get_db),
):
    """
    Retrieve paginated complaints list with total count and optional status/category/case_id filters.
    Private citizen complaints are excluded from unauthenticated public enumeration.
    """
    include_priv = bool(current_user and current_user.role.upper() in {"ADMIN", "OFFICER"})
    total, items = complaint_service.get_complaints(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        category=category,
        case_id=case_id,
        include_private=include_priv,
    )
    return ComplaintListResponse(
        total=total,
        items=items,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/track/{tracking_id}",
    response_model=ComplaintResponse,
    summary="Track complaint status by unique Case ID or tracking ID",
)
@router.get(
    "/case/{tracking_id}",
    response_model=ComplaintResponse,
    summary="Lookup complaint by unified Case ID (e.g. CP-2026-00093)",
)
def track_complaint(
    tracking_id: str = Path(..., description="Unique Case ID (e.g. CP-2026-00093)"),
    citizen_token: Optional[str] = Query(None, description="Optional citizen token for private complaints"),
    x_citizen_token: Optional[str] = Header(default=None, alias="X-Citizen-Token"),
    current_user: Optional[Officer] = Depends(get_optional_officer),
    db: Session = Depends(get_db),
):
    """
    Lookup endpoint for citizens and staff to check complaint status and timeline history by Case ID.
    If the complaint is marked private (`is_private=True`) and has a `citizen_token`,
    requires either the matching `citizen_token` or an authorized staff JWT.
    """
    complaint = complaint_service.get_complaint_by_tracking_id(db=db, tracking_id=tracking_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with Case ID '{tracking_id}' not found.",
        )

    if complaint.is_private and complaint.citizen_token:
        provided_token = (citizen_token or x_citizen_token or "").strip()
        is_authorized_staff = False
        if current_user:
            role_up = current_user.role.upper()
            if role_up == "ADMIN":
                is_authorized_staff = True
            elif role_up == "OFFICER" and complaint.assigned_officer_id == current_user.id:
                is_authorized_staff = True
            elif role_up == "WORKER" and complaint.assigned_worker_id == current_user.id:
                is_authorized_staff = True

        if not is_authorized_staff and provided_token != complaint.citizen_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: This is a private citizen complaint and requires an authorized token or role.",
            )

    return complaint


@router.get(
    "/{complaint_id}",
    response_model=ComplaintResponse,
    summary="Retrieve single complaint by database ID",
)
def get_complaint_by_id(
    complaint_id: int = Path(..., ge=1, description="Database ID of the complaint"),
    case_id: Optional[str] = Query(None, description="Case ID proof for private complaints"),
    citizen_token: Optional[str] = Query(None, description="Citizen token for private complaints"),
    x_case_id: Optional[str] = Header(default=None, alias="X-Case-ID"),
    x_citizen_token: Optional[str] = Header(default=None, alias="X-Citizen-Token"),
    current_user: Optional[Officer] = Depends(get_optional_officer),
    db: Session = Depends(get_db),
):
    """
    Retrieve single complaint details including audit logs by numeric database primary key.
    Enforces privacy: if `complaint.is_private` is True, blocks unauthorized enumeration by numeric ID.
    """
    complaint = complaint_service.get_complaint_by_id(db=db, complaint_id=complaint_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID {complaint_id} not found.",
        )

    if complaint.is_private:
        is_authorized = False
        if current_user:
            role_up = current_user.role.upper()
            if role_up == "ADMIN":
                is_authorized = True
            elif role_up == "OFFICER" and complaint.assigned_officer_id == current_user.id:
                is_authorized = True
            elif role_up == "WORKER" and complaint.assigned_worker_id == current_user.id:
                is_authorized = True

        provided_token = (citizen_token or x_citizen_token or "").strip()
        provided_cid = (case_id or x_case_id or "").strip().upper()
        if provided_token and complaint.citizen_token and provided_token == complaint.citizen_token:
            is_authorized = True
        elif provided_cid and provided_cid in {
            (complaint.case_id or "").upper(),
            (complaint.tracking_id or "").upper(),
        } and not complaint.citizen_token:
            is_authorized = True

        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to access another citizen's private complaint.",
            )

    return complaint
