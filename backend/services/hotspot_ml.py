from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional

from models import Complaint
from services.geo_utils import (
    get_cell_bounds,
    get_grid_cell_id,
    is_valid_coordinate,
)

DISCLAIMER_TEXT = (
    "Prototype Spatial Density Analysis: Meter-scale geographic clustering based on "
    "verified municipal grievance coordinates binned into spatial grid cells to inform "
    "rapid field squad dispatch."
)

PRIORITY_WEIGHTS = {
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}


def classify_intensity(count: int, severity_score: int) -> str:
    """
    Classify cluster intensity into HIGH, MEDIUM, or LOW:
    - HIGH: >= 6 complaints or high cumulative severity
    - MEDIUM: 3 to 5 complaints
    - LOW: 1 to 2 complaints
    """
    if count >= 6 or severity_score >= 12:
        return "HIGH"
    elif count >= 3 or severity_score >= 6:
        return "MEDIUM"
    return "LOW"


def detect_hotspots(
    complaints: List[Complaint],
    grid_size_meters: float = 500.0,
    intensity_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Group complaints into spatial grid cells and compute cluster metrics:
    - Dominant category
    - Dominant department
    - Complaint count & severity score
    - Intensity classification (HIGH, MEDIUM, LOW)
    - Cell bounds (SW, NE) and centroid
    """
    cells = defaultdict(list)
    valid_count = 0
    excluded_count = 0

    for c in complaints:
        if not is_valid_coordinate(c.latitude, c.longitude):
            excluded_count += 1
            continue
        valid_count += 1
        cell_id = get_grid_cell_id(c.latitude, c.longitude, grid_size_meters)
        cells[cell_id].append(c)

    hotspots = []
    for cell_id, items in cells.items():
        count = len(items)
        open_count = sum(1 for x in items if x.status == "OPEN")
        in_progress_count = sum(1 for x in items if x.status == "IN_PROGRESS")
        resolved_count = sum(1 for x in items if x.status == "RESOLVED")

        # Category and department frequencies
        cat_counts = Counter(x.category for x in items if x.category)
        dept_counts = Counter(x.department for x in items if x.department)

        dominant_cat = cat_counts.most_common(1)[0][0] if cat_counts else "Other"
        dominant_dept = dept_counts.most_common(1)[0][0] if dept_counts else "General"

        severity = sum(
            PRIORITY_WEIGHTS.get((x.priority or "").upper(), 1) for x in items
        )
        intensity = classify_intensity(count, severity)

        if intensity_filter and intensity.upper() != intensity_filter.strip().upper():
            continue

        bounds = get_cell_bounds(cell_id, grid_size_meters)
        center_lat = bounds["center"]["lat"]
        center_lng = bounds["center"]["lng"]

        hotspots.append({
            "cell_id": cell_id,
            "cluster_id": cell_id,
            "complaint_count": count,
            "open_count": open_count,
            "in_progress_count": in_progress_count,
            "resolved_count": resolved_count,
            "active_count": open_count + in_progress_count,
            "dominant_category": dominant_cat,
            "dominant_department": dominant_dept,
            "severity_score": severity,
            "intensity": intensity,
            "bounds": bounds,
            "center": bounds["center"],
            "center_latitude": center_lat,
            "center_longitude": center_lng,
            "radius_meters": int(grid_size_meters / 2),
            "category_breakdown": dict(cat_counts),
        })

    # Sort descending by complaint count, then severity score
    hotspots.sort(key=lambda x: (x["complaint_count"], x["severity_score"]), reverse=True)

    return {
        "hotspots": hotspots,
        "total_hotspots": len(hotspots),
        "total_valid_complaints": valid_count,
        "excluded_invalid_coordinates": excluded_count,
        "grid_size_meters": grid_size_meters,
        "disclaimer": DISCLAIMER_TEXT,
    }


def calculate_analytics_summary(hotspots: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate executive KPI summary over detected hotspots.
    """
    total = len(hotspots)
    high = sum(1 for h in hotspots if h["intensity"] == "HIGH")
    medium = sum(1 for h in hotspots if h["intensity"] == "MEDIUM")
    low = sum(1 for h in hotspots if h["intensity"] == "LOW")

    cat_counts = Counter(h["dominant_category"] for h in hotspots if h.get("dominant_category"))
    dept_counts = Counter(h["dominant_department"] for h in hotspots if h.get("dominant_department"))

    top_cat = cat_counts.most_common(1)[0][0] if cat_counts else "None"
    top_dept = dept_counts.most_common(1)[0][0] if dept_counts else "None"
    total_clustered = sum(h.get("complaint_count", 0) for h in hotspots)

    highest_risk = None
    if hotspots:
        top_spot = max(hotspots, key=lambda h: (h.get("severity_score", 0), h.get("complaint_count", 0)))
        c_lat = top_spot.get("center_latitude") or top_spot.get("center", {}).get("lat", 0)
        c_lng = top_spot.get("center_longitude") or top_spot.get("center", {}).get("lng", 0)
        highest_risk = {
            "cell_id": top_spot["cell_id"],
            "area_label": f"{c_lat:.4f}°N, {c_lng:.4f}°E",
            "severity_score": top_spot["severity_score"],
            "complaint_count": top_spot["complaint_count"],
        }

    return {
        "total_hotspots": total,
        "high_priority_hotspots": high,
        "medium_priority_hotspots": medium,
        "low_priority_hotspots": low,
        "high_intensity_count": high,
        "medium_intensity_count": medium,
        "low_intensity_count": low,
        "top_affected_category": top_cat,
        "most_affected_category": top_cat,
        "top_affected_department": top_dept,
        "total_complaints_in_hotspots": total_clustered,
        "highest_risk_area": highest_risk,
        "dominant_categories": dict(cat_counts),
        "dominant_departments": dict(dept_counts),
        "disclaimer": DISCLAIMER_TEXT,
    }


def generate_density_points(hotspots: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    """
    Extract weighted coordinates for map heatmap rendering:
    Returns [{"lat": float, "lng": float, "weight": float}, ...]
    """
    points = []
    max_count = max((h["complaint_count"] for h in hotspots), default=1)

    for h in hotspots:
        center = h.get("center", {})
        lat = center.get("lat")
        lng = center.get("lng")
        if lat is not None and lng is not None:
            norm_weight = min(1.0, max(0.2, h["complaint_count"] / max_count))
            points.append({
                "lat": lat,
                "lng": lng,
                "weight": round(norm_weight, 2),
                "count": h["complaint_count"],
            })

    return points

