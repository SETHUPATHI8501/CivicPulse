from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import Complaint, Officer
from services.auth_service import require_officer_or_admin
from services.hotspot_ml import (
    calculate_analytics_summary,
    detect_hotspots,
    generate_density_points,
    DISCLAIMER_TEXT,
)

router = APIRouter(prefix="/analytics", tags=["Hotspot Analytics"])


def _apply_complaint_filters(
    stmt,
    current_officer: Officer,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    complaint_status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    Apply role-based and query filters to complaints selection:
    - Non-admin officers only view complaints assigned to them
    - Admins view municipal complaints across all departments
    """
    if current_officer.role.upper() != "ADMIN":
        stmt = stmt.where(Complaint.assigned_officer_id == current_officer.id)

    if category:
        stmt = stmt.where(Complaint.category == category.strip())

    if priority:
        stmt = stmt.where(Complaint.priority == priority.strip().upper())

    if complaint_status:
        stmt = stmt.where(Complaint.status == complaint_status.strip().upper())

    if start_date:
        try:
            dt_start = datetime.fromisoformat(start_date.strip())
            if dt_start.tzinfo is None:
                dt_start = dt_start.replace(tzinfo=timezone.utc)
            stmt = stmt.where(Complaint.created_at >= dt_start)
        except ValueError:
            pass

    if end_date:
        try:
            dt_end = datetime.fromisoformat(end_date.strip())
            if dt_end.tzinfo is None:
                dt_end = dt_end.replace(tzinfo=timezone.utc)
            stmt = stmt.where(Complaint.created_at <= dt_end)
        except ValueError:
            pass

    return stmt


@router.get(
    "/summary",
    summary="Get aggregated hotspot metrics and KPI summary",
)
def get_analytics_summary(
    grid_size: float = Query(500.0, ge=100.0, le=2000.0, description="Grid resolution in meters"),
    category: Optional[str] = Query(None, description="Filter by complaint category"),
    priority: Optional[str] = Query(None, description="Filter by priority (LOW, MEDIUM, HIGH)"),
    status: Optional[str] = Query(None, description="Filter by complaint status"),
    start_date: Optional[str] = Query(None, description="Filter start date ISO string"),
    end_date: Optional[str] = Query(None, description="Filter end date ISO string"),
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(require_officer_or_admin),
) -> Dict[str, Any]:
    """
    Compute total hotspots, intensity breakdown, and affected category distributions.
    Admins view municipal totals; officers view their assigned portfolio.
    """
    stmt = select(Complaint)
    stmt = _apply_complaint_filters(
        stmt,
        current_officer,
        category=category,
        priority=priority,
        complaint_status=status,
        start_date=start_date,
        end_date=end_date,
    )
    complaints = db.execute(stmt).scalars().all()

    hotspot_result = detect_hotspots(complaints, grid_size_meters=grid_size)
    summary = calculate_analytics_summary(hotspot_result["hotspots"])
    summary["grid_size_meters"] = hotspot_result["grid_size_meters"]
    summary["total_valid_complaints"] = hotspot_result["total_valid_complaints"]
    summary["excluded_invalid_coordinates"] = hotspot_result["excluded_invalid_coordinates"]

    return summary


@router.get(
    "/hotspots",
    summary="Get ranked list of spatial complaint hotspots",
)
def get_hotspots_list(
    grid_size: float = Query(500.0, ge=100.0, le=2000.0, description="Grid resolution in meters"),
    category: Optional[str] = Query(None, description="Filter by complaint category"),
    priority: Optional[str] = Query(None, description="Filter by priority (LOW, MEDIUM, HIGH)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    intensity: Optional[str] = Query(None, description="Filter by intensity (LOW, MEDIUM, HIGH)"),
    start_date: Optional[str] = Query(None, description="Filter start date ISO string"),
    end_date: Optional[str] = Query(None, description="Filter end date ISO string"),
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(require_officer_or_admin),
) -> Dict[str, Any]:
    """
    List all detected spatial hotspot clusters with bounds, centroids, and severity metrics.
    Zero PII is exposed.
    """
    stmt = select(Complaint)
    stmt = _apply_complaint_filters(
        stmt,
        current_officer,
        category=category,
        priority=priority,
        complaint_status=status,
        start_date=start_date,
        end_date=end_date,
    )
    complaints = db.execute(stmt).scalars().all()

    return detect_hotspots(
        complaints,
        grid_size_meters=grid_size,
        intensity_filter=intensity,
    )


@router.get(
    "/complaint-density",
    summary="Get weighted coordinate points for map density visualization",
)
def get_complaint_density(
    grid_size: float = Query(500.0, ge=100.0, le=2000.0, description="Grid resolution in meters"),
    category: Optional[str] = Query(None, description="Filter by complaint category"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(require_officer_or_admin),
) -> Dict[str, Any]:
    """
    Provide weighted geographic coordinates representing density hotspots
    for interactive map overlays.
    """
    stmt = select(Complaint)
    stmt = _apply_complaint_filters(
        stmt,
        current_officer,
        category=category,
        priority=priority,
        complaint_status=status,
    )
    complaints = db.execute(stmt).scalars().all()

    result = detect_hotspots(complaints, grid_size_meters=grid_size)
    density_points = generate_density_points(result["hotspots"])

    return {
        "points": density_points,
        "total_points": len(density_points),
        "grid_size_meters": result["grid_size_meters"],
        "disclaimer": DISCLAIMER_TEXT,
    }

