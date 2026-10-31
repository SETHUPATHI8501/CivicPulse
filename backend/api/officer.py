from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Query, UploadFile, status
from sqlalchemy.orm import Session

from database import get_db
from models import Officer
from schemas.auth import (
    ComplaintAssignRequest,
    ComplaintStatusUpdateRequest,
    OfficerCreate,
    OfficerListResponse,
    OfficerResponse,
)
from schemas.complaint import ComplaintListResponse, ComplaintResponse
from services import officer_service
from services.auth_service import require_admin, require_officer_or_admin

router = APIRouter(tags=["Officers & Operations"])


# =========================================================================
# 1. Administrative Officer Management APIs
# =========================================================================

@router.post(
    "/officers",
    response_model=OfficerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new officer account (ADMIN only)",
)
def create_officer_account(
    officer_in: OfficerCreate,
    current_admin: Officer = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Administrative endpoint to register a new municipal officer or admin.
    Requires ADMIN JWT token.
    """
    return officer_service.create_officer(db=db, officer_in=officer_in)


@router.get(
    "/officers",
    response_model=OfficerListResponse,
    summary="List all officers (ADMIN only)",
)
def list_all_officers(
    department: Optional[str] = Query(None, description="Filter officers by municipal department"),
    current_admin: Officer = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Administrative endpoint to list registered officers with optional department filter.
    """
    officers = officer_service.list_officers(db=db, department=department)
    return OfficerListResponse(total=len(officers), items=officers)


@router.get(
    "/officers/{officer_id}",
    response_model=OfficerResponse,
    summary="Get officer details by ID (ADMIN only)",
)
def get_officer_details(
    officer_id: int = Path(..., ge=1, description="Database integer ID of officer"),
    current_admin: Officer = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Retrieve single officer details. Never returns password hashes.
    """
    officer = officer_service.get_officer_by_id(db=db, officer_id=officer_id)
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Officer with ID {officer_id} not found.",
        )
    return officer


# =========================================================================
# 2. Complaint Assignment & Officer Dashboard APIs
# =========================================================================

@router.patch(
    "/officer/complaints/{complaint_id}/assign",
    response_model=ComplaintResponse,
    summary="Assign complaint to department officer (ADMIN only)",
)
def assign_complaint_to_officer(
    complaint_id: int = Path(..., ge=1, description="Complaint ID to assign"),
    assignment_in: ComplaintAssignRequest = ...,
    current_admin: Officer = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Assign an active complaint to an officer whose department matches the complaint.
    Requires ADMIN JWT. Appends ASSIGNED audit log entry.
    """
    return officer_service.assign_complaint(
        db=db,
        complaint_id=complaint_id,
        officer_id=assignment_in.officer_id,
        assigned_by_name=current_admin.name,
        note=assignment_in.note,
    )


@router.get(
    "/officer/complaints",
    response_model=ComplaintListResponse,
    summary="Get complaints queue for logged in officer or admin",
)
def get_officer_complaints_queue(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status (e.g. OPEN, IN_PROGRESS)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_officer: Officer = Depends(require_officer_or_admin),
    db: Session = Depends(get_db),
):
    """
    Returns complaints for municipal personnel:
    - Regular officers see only complaints assigned to their officer ID.
    - Administrators can view all complaints across the municipality.
    """
    total, items = officer_service.get_officer_complaints(
        db=db,
        current_officer=current_officer,
        skip=skip,
        limit=limit,
        status=status,
        category=category,
    )
    return ComplaintListResponse(
        total=total,
        items=items,
        skip=skip,
        limit=limit,
    )


@router.patch(
    "/officer/complaints/{complaint_id}/status",
    response_model=ComplaintResponse,
    summary="Update complaint status (Assigned Officer or ADMIN)",
)
def update_complaint_status_transition(
    complaint_id: int = Path(..., ge=1, description="ID of complaint to update"),
    status_in: ComplaintStatusUpdateRequest = ...,
    current_officer: Officer = Depends(require_officer_or_admin),
    db: Session = Depends(get_db),
):
    """
    Transition complaint status following state machine rules:
    - OPEN -> IN_PROGRESS, NEEDS_INFO, REJECTED
    - IN_PROGRESS -> RESOLVED, NEEDS_INFO
    - NEEDS_INFO -> OPEN, IN_PROGRESS, REJECTED
    Appends audit log entry with officer name and remarks.
    """
    return officer_service.update_complaint_status(
        db=db,
        complaint_id=complaint_id,
        new_status=status_in.status,
        current_officer=current_officer,
        note=status_in.note,
        resolution_note=status_in.resolution_note,
        resolution_photo_url=status_in.resolution_photo_url,
    )


@router.patch(
    "/officer/complaints/{complaint_id}/resolve",
    response_model=ComplaintResponse,
    summary="Resolve assigned complaint with proof photo and notes",
)
async def resolve_complaint_endpoint(
    complaint_id: int = Path(..., ge=1, description="Database ID of complaint to resolve"),
    resolution_photo: UploadFile = File(..., description="Proof of work resolution photo (< 5 MB)"),
    resolution_note: str = Form(..., description="Mandatory details of resolution work done"),
    current_officer: Officer = Depends(require_officer_or_admin),
    db: Session = Depends(get_db),
):
    """
    Dedicated resolution endpoint for municipal officers and administrators:
    - Requires authenticated officer assigned to the complaint (or ADMIN role).
    - Requires current status to be IN_PROGRESS.
    - Validates image file format (JPEG, PNG, WEBP) and size (<= 5 MB).
    - Saves photo into uploads/resolutions with safe unique name.
    - Sets complaint status to RESOLVED and records audit log in ComplaintLog.
    - Guarantees transactional rollback and file cleanup on failure.
    """
    file_bytes = await resolution_photo.read()
    return officer_service.resolve_complaint(
        db=db,
        complaint_id=complaint_id,
        current_officer=current_officer,
        resolution_note=resolution_note,
        file_bytes=file_bytes,
        filename=resolution_photo.filename or "resolution.jpg",
        content_type=resolution_photo.content_type,
    )

