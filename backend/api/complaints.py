from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from database import get_db
from schemas.complaint import (
    ComplaintCreate,
    ComplaintListResponse,
    ComplaintResponse,
)
from services import complaint_service

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.post(
    "",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new citizen complaint",
)
def create_complaint(
    complaint_in: ComplaintCreate,
    db: Session = Depends(get_db),
):
    """
    Register a new citizen complaint:
    - Validates text and coordinate bounds.
    - Generates a unique tracking ID.
    - Applies Phase 1 baseline values.
    - Saves initial audit log.
    """
    return complaint_service.create_complaint(db=db, complaint_in=complaint_in)


@router.get(
    "",
    response_model=ComplaintListResponse,
    summary="List complaints with pagination and filtering",
)
def list_complaints(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max number of records to return"),
    status: Optional[str] = Query(None, description="Filter by complaint status (e.g. OPEN, RESOLVED)"),
    category: Optional[str] = Query(None, description="Filter by category (e.g. Other, Roads)"),
    db: Session = Depends(get_db),
):
    """
    Retrieve paginated complaints list with total count and optional status/category filters.
    """
    total, items = complaint_service.get_complaints(
        db=db,
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


# IMPORTANT: Register /track/{tracking_id} before /{complaint_id} so the dynamic ID route does not intercept it
@router.get(
    "/track/{tracking_id}",
    response_model=ComplaintResponse,
    summary="Track complaint status by unique tracking ID",
)
def track_complaint(
    tracking_id: str = Path(..., description="Unique tracking identifier (e.g. CP-9F2B81A4)"),
    db: Session = Depends(get_db),
):
    """
    Public tracking endpoint for citizens to check complaint status and timeline history.
    """
    complaint = complaint_service.get_complaint_by_tracking_id(db=db, tracking_id=tracking_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with tracking ID '{tracking_id}' not found.",
        )
    return complaint


@router.get(
    "/{complaint_id}",
    response_model=ComplaintResponse,
    summary="Retrieve single complaint by database ID",
)
def get_complaint_by_id(
    complaint_id: int = Path(..., ge=1, description="Database ID of the complaint"),
    db: Session = Depends(get_db),
):
    """
    Retrieve single complaint details including audit logs by numeric database primary key.
    """
    complaint = complaint_service.get_complaint_by_id(db=db, complaint_id=complaint_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID {complaint_id} not found.",
        )
    return complaint

