import concurrent.futures
import json
import logging
import math
import os
import re
import time
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, WebSocket, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from models import CivicNotification, Complaint, ComplaintLog, Officer, SOSAlert, SOSLog
from services.ai_classifier import classify_complaint, get_gemini_config
from services.complaint_service import generate_unique_case_id
from services.geo_utils import haversine_distance
from services.officer_service import validate_image_bytes

logger = logging.getLogger("civicpulse.advanced_service")

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
SOS_UPLOADS_DIR = UPLOADS_DIR / "sos"
WORKER_UPLOADS_DIR = UPLOADS_DIR / "workers"

VALID_SOS_TYPES = {
    "Road accident",
    "Fire hazard",
    "Flooding or waterlogging",
    "Fallen electric pole or dangerous electrical hazard",
    "Dangerous open manhole",
    "Severe public infrastructure hazard",
    "Other public safety emergency",
}

VALID_SOS_STATUSES = {
    "SUBMITTED",
    "ACKNOWLEDGED",
    "OFFICER_ASSIGNED",
    "RESPONDING",
    "RESOLVED",
    "CANCELLED",
}

# Known Tamil Nadu civic reference hubs for accurate offline/online reverse geocoding
TAMIL_NADU_HUBS = [
    {"name": "Tiruchengode Municipal Bus Stand, Namakkal District", "name_ta": "திருச்செங்கோடு பேருந்து நிலையம், நாமக்கல் மாவட்டம்", "lat": 11.3802, "lon": 77.8944},
    {"name": "KSR Kalvi Nagar, Tiruchengode, Tamil Nadu", "name_ta": "கே.எஸ்.ஆர் கல்வி நகர், திருச்செங்கோடு", "lat": 11.3635, "lon": 77.8282},
    {"name": "Erode Central Junction, Erode District", "name_ta": "ஈரோடு மத்திய சந்திப்பு, ஈரோடு மாவட்டம்", "lat": 11.3410, "lon": 77.7172},
    {"name": "Namakkal Fort Main Road, Namakkal District", "name_ta": "நாமக்கல் கோட்டை பிரதான சாலை", "lat": 11.2189, "lon": 78.1674},
    {"name": "Salem Five Roads Junction, Salem District", "name_ta": "சேலம் ஐந்து ரோடு சந்திப்பு", "lat": 11.6643, "lon": 78.1460},
    {"name": "Gandhipuram Town Hall, Coimbatore", "name_ta": "காந்திபுரம் டவுன் ஹால், கோயம்புத்தூர்", "lat": 11.0168, "lon": 76.9558},
    {"name": "Karur Bus Stand Circle, Karur District", "name_ta": "கரூர் பேருந்து நிலைய வட்டம்", "lat": 10.9601, "lon": 78.0766},
    {"name": "Komarapalayam Cauvery Bridge Road", "name_ta": "குமாரபாளையம் காவிரி பாலம் சாலை", "lat": 11.4452, "lon": 77.6946},
    {"name": "Sankagiri Main Bazaar Street", "name_ta": "சங்ககிரி பிரதான கடைவீதி", "lat": 11.4820, "lon": 77.8695},
    {"name": "Pallipalayam Municipal Ward 4", "name_ta": "பள்ளிபாளையம் நகராட்சி வார்டு 4", "lat": 11.3647, "lon": 77.7524},
]


# =========================================================================
# 1. Real-Time WebSocket Broadcast & Notification Manager
# =========================================================================

class RealtimeBroadcaster:
    """Manages active WebSocket clients and broadcasts live civic/SOS events."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, payload: Dict[str, Any]):
        stale: List[WebSocket] = []
        message_text = json.dumps(payload, default=str)
        for conn in list(self.active_connections):
            try:
                await conn.send_text(message_text)
            except Exception:
                stale.append(conn)
        for s in stale:
            self.disconnect(s)


broadcaster = RealtimeBroadcaster()


def create_notification(
    db: Session,
    recipient_role: str,
    event_type: str,
    title: str,
    message: str,
    recipient_id: Optional[int] = None,
    tracking_id: Optional[str] = None,
) -> CivicNotification:
    """Persist an in-app notification for real-time polling and audit visibility."""
    notif = CivicNotification(
        recipient_role=recipient_role.upper(),
        recipient_id=recipient_id,
        tracking_id=tracking_id,
        event_type=event_type,
        title=title,
        message=message,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def get_notifications(
    db: Session,
    role: Optional[str] = None,
    recipient_id: Optional[int] = None,
    tracking_id: Optional[str] = None,
    limit: int = 30,
) -> List[CivicNotification]:
    """Fetch recent notifications for citizen tracking or authenticated staff roles."""
    stmt = select(CivicNotification)
    conditions = []

    if tracking_id:
        conditions.append(CivicNotification.tracking_id == tracking_id.strip().upper())

    if role:
        role_upper = role.strip().upper()
        if role_upper == "ADMIN":
            conditions.append(
                CivicNotification.recipient_role.in_(["ADMIN", "ALL_STAFF", "OFFICER", "WORKER"])
            )
        elif role_upper in {"OFFICER", "WORKER"}:
            if recipient_id:
                conditions.append(
                    or_(
                        CivicNotification.recipient_role == "ALL_STAFF",
                        CivicNotification.recipient_role == role_upper,
                        CivicNotification.recipient_id == recipient_id,
                    )
                )
            else:
                conditions.append(
                    CivicNotification.recipient_role.in_(["ALL_STAFF", role_upper])
                )
        elif role_upper == "CITIZEN" and not tracking_id:
            conditions.append(CivicNotification.recipient_role == "CITIZEN")

    if conditions:
        stmt = stmt.where(or_(*conditions))

    stmt = stmt.order_by(CivicNotification.created_at.desc()).limit(limit)
    return list(db.execute(stmt).scalars().all())


def mark_notification_read(db: Session, notification_id: int) -> Optional[CivicNotification]:
    notif = db.execute(
        select(CivicNotification).where(CivicNotification.id == notification_id)
    ).scalar_one_or_none()
    if notif:
        notif.is_read = True
        db.commit()
        db.refresh(notif)
    return notif


# =========================================================================
# 2. Reverse Geocoding, Nearby Search & Route Distance Estimation
# =========================================================================

def reverse_geocode_coordinates(latitude: float, longitude: float, lang: str = "en") -> Dict[str, Any]:
    """
    Resolve GPS coordinates into a human-readable street/ward/town address.
    1. Attempts OpenStreetMap Nominatim with a strict 1.8s timeout.
    2. Falls back deterministically to the nearest Tamil Nadu municipal reference hub
       with directional offset so it works 100% reliably offline and in tests.
    """
    nearest_hub = TAMIL_NADU_HUBS[0]
    min_dist_m = float("inf")
    for hub in TAMIL_NADU_HUBS:
        d = haversine_distance(latitude, longitude, hub["lat"], hub["lon"])
        if d < min_dist_m:
            min_dist_m = d
            nearest_hub = hub

    dist_km = round(min_dist_m / 1000.0, 2)
    hub_label = nearest_hub["name_ta"] if lang == "ta" else nearest_hub["name"]
    if min_dist_m <= 350:
        fallback_address = f"Near {hub_label}" if lang != "ta" else f"{hub_label} அருகில்"
    else:
        fallback_address = (
            f"{dist_km} km from {hub_label} ({latitude:.4f}°N, {longitude:.4f}°E)"
            if lang != "ta"
            else f"{hub_label} இலிருந்து {dist_km} கி.மீ ({latitude:.4f}°N, {longitude:.4f}°E)"
        )

    # Attempt online Nominatim lookup with short timeout
    if os.getenv("DISABLE_ONLINE_GEOCODING", "").lower() not in {"1", "true"}:
        try:
            url = (
                f"https://nominatim.openstreetmap.org/reverse?format=jsonv2"
                f"&lat={latitude}&lon={longitude}&zoom=18&addressdetails=1"
            )
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "CivicPulseAI-TamilNadu-MunicipalPlatform/2.0",
                    "Accept-Language": "ta,en;q=0.9" if lang == "ta" else "en,ta;q=0.8",
                },
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    payload = json.loads(resp.read().decode("utf-8"))
                    display_name = payload.get("display_name")
                    if display_name:
                        return {
                            "latitude": latitude,
                            "longitude": longitude,
                            "address": display_name,
                            "nearest_landmark": hub_label,
                            "distance_to_landmark_m": round(min_dist_m, 1),
                            "source": "NOMINATIM_OSM",
                        }
        except Exception:
            pass

    return {
        "latitude": latitude,
        "longitude": longitude,
        "address": fallback_address,
        "nearest_landmark": hub_label,
        "distance_to_landmark_m": round(min_dist_m, 1),
        "source": "MUNICIPAL_GIS_INDEX",
    }


def get_nearby_complaints(
    db: Session,
    latitude: float,
    longitude: float,
    radius_km: float = 2.0,
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Find complaints within `radius_km` of (`latitude`, `longitude`) sorted by distance.
    Does not expose private citizen PII; returns public civic issue telemetry.
    """
    stmt = select(Complaint)
    if category:
        stmt = stmt.where(Complaint.category == category)
    if status_filter:
        stmt = stmt.where(Complaint.status == status_filter.upper())

    all_items = db.execute(stmt).scalars().all()
    max_dist_m = radius_km * 1000.0
    nearby: List[Dict[str, Any]] = []

    for c in all_items:
        dist_m = haversine_distance(latitude, longitude, c.latitude, c.longitude)
        if dist_m <= max_dist_m:
            nearby.append(
                {
                    "id": c.id,
                    "case_id": c.case_id or c.tracking_id,
                    "tracking_id": c.tracking_id,
                    "category": c.category,
                    "priority": c.priority,
                    "department": c.department,
                    "status": c.status,
                    "citizen_text": c.citizen_text,
                    "latitude": c.latitude,
                    "longitude": c.longitude,
                    "address_text": c.address_text,
                    "photo_url": c.photo_url,
                    "duplicate_group_id": c.duplicate_group_id,
                    "distance_meters": round(dist_m, 1),
                    "distance_m": round(dist_m, 1),
                    "distance_km": round(dist_m / 1000.0, 2),
                    "created_at": c.created_at,
                }
            )

    nearby.sort(key=lambda x: x["distance_meters"])
    return nearby[:limit]


def estimate_navigation_route(
    from_lat: float,
    from_lon: float,
    to_lat: float,
    to_lon: float,
) -> Dict[str, Any]:
    """
    Calculate Haversine straight-line distance, estimated road distance (1.28x urban tortuosity factor),
    compass bearing, and estimated field response travel time.
    """
    straight_m = haversine_distance(from_lat, from_lon, to_lat, to_lon)
    road_m = straight_m * 1.28
    road_km = round(road_m / 1000.0, 2)
    # Assume average municipal urban response speed of 30 km/h
    eta_minutes = max(1, round((road_km / 30.0) * 60))

    # Compass bearing calculation
    phi1, phi2 = math.radians(from_lat), math.radians(to_lat)
    dlon = math.radians(to_lon - from_lon)
    x = math.sin(dlon) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlon)
    initial_bearing = (math.degrees(math.atan2(x, y)) + 360) % 360
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    compass = directions[round(initial_bearing / 45) % 8]

    return {
        "from": {"latitude": from_lat, "longitude": from_lon},
        "to": {"latitude": to_lat, "longitude": to_lon},
        "straight_distance_meters": round(straight_m, 1),
        "estimated_road_distance_km": road_km,
        "estimated_travel_minutes": eta_minutes,
        "bearing_degrees": round(initial_bearing, 1),
        "compass_direction": compass,
        "google_maps_directions_url": (
            f"https://www.google.com/maps/dir/?api=1"
            f"&origin={from_lat},{from_lon}&destination={to_lat},{to_lon}&travelmode=driving"
        ),
    }


# =========================================================================
# 3. Worker Role & Field Operations Workflow
# =========================================================================

def list_workers(db: Session, department: Optional[str] = None) -> List[Officer]:
    """List active municipal workers (or all field staff if requested)."""
    stmt = select(Officer).where(Officer.role == "WORKER", Officer.is_active == True)  # noqa: E712
    if department:
        stmt = stmt.where(Officer.department == department.strip())
    return list(db.execute(stmt.order_by(Officer.name.asc())).scalars().all())


def assign_worker_to_complaint(
    db: Session,
    complaint_id: int,
    worker_id: int,
    current_officer: Officer,
    note: Optional[str] = None,
) -> Complaint:
    """
    Assign a field worker (role=WORKER) to a complaint.
    Accessible by ADMIN or the OFFICER assigned to the complaint.
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

    if current_officer.role.upper() != "ADMIN" and complaint.assigned_officer_id != current_officer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an administrator or the assigned department officer can dispatch a field worker.",
        )

    worker = db.execute(select(Officer).where(Officer.id == worker_id)).scalar_one_or_none()
    if not worker or not worker.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active worker with ID {worker_id} not found.",
        )

    if worker.role.upper() not in {"WORKER", "OFFICER"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Account '{worker.name}' does not hold the WORKER role.",
        )

    complaint.assigned_worker_id = worker.id
    case_id = complaint.case_id or complaint.tracking_id
    log_entry = ComplaintLog(
        complaint_id=complaint.id,
        actor_name=current_officer.name,
        actor_role=current_officer.role,
        action="WORKER_ASSIGNED",
        old_status=complaint.status,
        new_status=complaint.status,
        officer_id=current_officer.id,
        note=note or f"Complaint {case_id} dispatched to field worker {worker.name} ({worker.department}).",
    )
    db.add(log_entry)
    db.commit()
    db.refresh(complaint)

    create_notification(
        db=db,
        recipient_role="WORKER",
        recipient_id=worker.id,
        tracking_id=case_id,
        event_type="WORKER_ASSIGNED",
        title=f"New Field Work Dispatched: {case_id}",
        message=f"Your assigned complaint {case_id} ({complaint.category}) was dispatched by {current_officer.name}. Note: {note or 'Inspect and repair immediately.'}",
    )
    create_notification(
        db=db,
        recipient_role="CITIZEN",
        tracking_id=case_id,
        event_type="WORKER_ASSIGNED",
        title=f"Field Worker Dispatched: {case_id}",
        message=f"Your complaint {case_id} has been assigned to field worker {worker.name} ({worker.department}).",
    )
    return complaint


def get_worker_complaints(
    db: Session,
    current_user: Officer,
    status_filter: Optional[str] = None,
) -> Tuple[int, List[Complaint]]:
    """
    Return complaints assigned to the logged-in WORKER.
    If ADMIN/OFFICER calls this endpoint, returns all worker-dispatched or department complaints.
    """
    stmt = select(Complaint).options(selectinload(Complaint.logs))
    role_upper = current_user.role.upper()

    if role_upper == "WORKER":
        stmt = stmt.where(
            or_(
                Complaint.assigned_worker_id == current_user.id,
                Complaint.assigned_officer_id == current_user.id,
            )
        )
    elif role_upper == "OFFICER":
        stmt = stmt.where(Complaint.assigned_officer_id == current_user.id)

    if status_filter:
        stmt = stmt.where(Complaint.status == status_filter.strip().upper())

    items = list(db.execute(stmt.order_by(Complaint.created_at.desc())).scalars().all())
    return len(items), items


def _save_worker_photo(file_bytes: bytes, filename: str, content_type: Optional[str], prefix: str) -> str:
    ext = validate_image_bytes(file_bytes, filename=filename, content_type=content_type)
    WORKER_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{prefix}_{uuid.uuid4().hex[:12]}{ext}"
    (WORKER_UPLOADS_DIR / safe_name).write_bytes(file_bytes)
    return f"/uploads/workers/{safe_name}"


def update_worker_field_work(
    db: Session,
    complaint_id: int,
    current_worker: Officer,
    work_status: str,
    completion_note: str,
    before_bytes: Optional[bytes] = None,
    before_filename: Optional[str] = None,
    before_mime: Optional[str] = None,
    after_bytes: Optional[bytes] = None,
    after_filename: Optional[str] = None,
    after_mime: Optional[str] = None,
) -> Complaint:
    """
    Allow an assigned WORKER (or OFFICER/ADMIN) to:
    - Start work (sets complaint status to IN_PROGRESS if OPEN/ASSIGNED)
    - Upload before/after field inspection photos
    - Record field completion notes for officer verification
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

    role_upper = current_worker.role.upper()
    is_authorized = (
        role_upper == "ADMIN"
        or complaint.assigned_worker_id == current_worker.id
        or complaint.assigned_officer_id == current_worker.id
    )
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update field work for this complaint.",
        )

    old_status = complaint.status.upper()
    action_upper = work_status.strip().upper()
    if action_upper not in {"IN_PROGRESS", "WORK_COMPLETED"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Worker status action must be 'IN_PROGRESS' or 'WORK_COMPLETED'.",
        )

    if before_bytes and len(before_bytes) > 0:
        complaint.worker_before_photo_url = _save_worker_photo(
            before_bytes, before_filename or "before.jpg", before_mime, f"wk_before_{complaint_id}"
        )

    if after_bytes and len(after_bytes) > 0:
        complaint.worker_after_photo_url = _save_worker_photo(
            after_bytes, after_filename or "after.jpg", after_mime, f"wk_after_{complaint_id}"
        )

    if completion_note and completion_note.strip():
        complaint.worker_completion_note = completion_note.strip()

    # Transition OPEN/ASSIGNED -> IN_PROGRESS so Officer can verify and resolve
    if old_status in {"OPEN", "ASSIGNED", "NEEDS_INFO"}:
        complaint.status = "IN_PROGRESS"

    log_entry = ComplaintLog(
        complaint_id=complaint.id,
        actor_name=current_worker.name,
        actor_role=role_upper,
        action=f"WORKER_{action_upper}",
        old_status=old_status,
        new_status=complaint.status,
        officer_id=current_worker.id,
        note=(
            f"Field worker update ({action_upper}): {completion_note.strip()}"
            if completion_note and completion_note.strip()
            else f"Field worker marked task as {action_upper}."
        ),
    )
    db.add(log_entry)
    db.commit()
    db.refresh(complaint)

    case_id = complaint.case_id or complaint.tracking_id
    create_notification(
        db=db,
        recipient_role="OFFICER",
        recipient_id=complaint.assigned_officer_id,
        tracking_id=case_id,
        event_type="STATUS_CHANGED",
        title=f"Worker Field Update: {case_id}",
        message=f"{current_worker.name} submitted {action_upper} update for {case_id}: {completion_note or 'Field evidence uploaded.'}",
    )
    create_notification(
        db=db,
        recipient_role="CITIZEN",
        tracking_id=case_id,
        event_type="STATUS_CHANGED",
        title=f"Field Progress Update: {case_id}",
        message=f"Your complaint {case_id} has a field progress update ({action_upper}) from {current_worker.name}.",
    )
    return complaint


# =========================================================================
# 4. SOS Emergency Response System (With Rate Limiting & Audit Trail)
# =========================================================================

_sos_rate_window: List[float] = []
MAX_SOS_PER_MINUTE = 15


def _check_sos_rate_limit():
    now = time.time()
    while _sos_rate_window and now - _sos_rate_window[0] > 60.0:
        _sos_rate_window.pop(0)
    if len(_sos_rate_window) >= MAX_SOS_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="SOS rate limit exceeded. For immediate life-threatening emergencies, dial 112 / 108 / 101.",
        )
    _sos_rate_window.append(now)


def create_sos_alert(
    db: Session,
    emergency_type: str,
    description: str,
    latitude: float,
    longitude: float,
    citizen_name: Optional[str] = None,
    citizen_phone: Optional[str] = None,
    address_text: Optional[str] = None,
    trusted_contacts: Optional[List[Dict[str, str]]] = None,
    photo_bytes: Optional[bytes] = None,
    photo_filename: Optional[str] = None,
    photo_mime: Optional[str] = None,
) -> SOSAlert:
    """
    Create a verified SOS public safety emergency alert:
    - Generates unique SOS tracking ID (SOS-XXXXXXXX).
    - Resolves readable address via reverse geocoding if not provided.
    - Stores optional evidence photo in uploads/sos/.
    - Records initial SUBMITTED entry in SOSLog.
    - Creates high-priority SOS_RECEIVED notification for authorized responders.
    """
    _check_sos_rate_limit()

    clean_type = emergency_type.strip()
    if clean_type not in VALID_SOS_TYPES:
        clean_type = "Other public safety emergency"

    clean_desc = description.strip() if description else ""
    if len(clean_desc) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Emergency description must be at least 3 characters.",
        )

    photo_url: Optional[str] = None
    if photo_bytes and len(photo_bytes) > 0:
        ext = validate_image_bytes(photo_bytes, filename=photo_filename or "sos.jpg", content_type=photo_mime)
        SOS_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        safe_name = f"sos_{uuid.uuid4().hex[:12]}{ext}"
        (SOS_UPLOADS_DIR / safe_name).write_bytes(photo_bytes)
        photo_url = f"/uploads/sos/{safe_name}"

    resolved_address = address_text
    if not resolved_address:
        geo_info = reverse_geocode_coordinates(latitude, longitude)
        resolved_address = geo_info.get("address")

    tracking_id = generate_unique_case_id(db=db, prefix="SOS")

    sos = SOSAlert(
        case_id=tracking_id,
        tracking_id=tracking_id,
        emergency_type=clean_type,
        description=clean_desc,
        latitude=latitude,
        longitude=longitude,
        address_text=resolved_address,
        photo_url=photo_url,
        status="SUBMITTED",
        priority="CRITICAL",
        citizen_name=citizen_name.strip() if citizen_name else "Citizen",
        citizen_phone=citizen_phone.strip() if citizen_phone else None,
        trusted_contacts_json=json.dumps(trusted_contacts) if trusted_contacts else None,
    )
    db.add(sos)
    db.flush()

    initial_log = SOSLog(
        sos_id=sos.id,
        actor_name=sos.citizen_name or "Citizen",
        actor_role="CITIZEN",
        action="SOS_SUBMITTED",
        old_status=None,
        new_status="SUBMITTED",
        note=f"Emergency SOS activated: [{clean_type}] at {resolved_address}. {clean_desc}",
    )
    db.add(initial_log)
    db.commit()
    db.refresh(sos)

    create_notification(
        db=db,
        recipient_role="ALL_STAFF",
        tracking_id=sos.tracking_id,
        event_type="SOS_RECEIVED",
        title=f"CRITICAL SOS ALERT: {clean_type} ({sos.tracking_id})",
        message=f"Location: {resolved_address} ({latitude:.4f}, {longitude:.4f}) — {clean_desc}",
    )
    return sos


def get_sos_by_tracking_id(db: Session, tracking_id: str) -> Optional[SOSAlert]:
    clean_id = (tracking_id or "").strip().upper()
    stmt = (
        select(SOSAlert)
        .options(selectinload(SOSAlert.logs))
        .where(
            or_(
                func.upper(SOSAlert.case_id) == clean_id,
                func.upper(SOSAlert.tracking_id) == clean_id,
            )
        )
    )
    return db.execute(stmt).scalar_one_or_none()


def list_sos_alerts(
    db: Session,
    status_filter: Optional[str] = None,
    limit: int = 50,
) -> Tuple[int, List[SOSAlert]]:
    """List SOS emergency incidents for authorized officers and administrators ONLY."""
    stmt = select(SOSAlert).options(selectinload(SOSAlert.logs))
    if status_filter:
        stmt = stmt.where(SOSAlert.status == status_filter.strip().upper())
    items = list(db.execute(stmt.order_by(SOSAlert.created_at.desc()).limit(limit)).scalars().all())
    return len(items), items


def update_sos_status(
    db: Session,
    sos_id: int,
    current_officer: Officer,
    new_status: str,
    note: Optional[str] = None,
    assigned_officer_id: Optional[int] = None,
) -> SOSAlert:
    """Allow authorized OFFICER or ADMIN to acknowledge, assign, respond, or resolve an SOS alert."""
    sos = db.execute(
        select(SOSAlert)
        .options(selectinload(SOSAlert.logs))
        .where(SOSAlert.id == sos_id)
    ).scalar_one_or_none()

    if not sos:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SOS alert with ID {sos_id} not found.",
        )

    target_status = new_status.strip().upper()
    if target_status not in VALID_SOS_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid SOS status '{target_status}'. Allowed: {sorted(list(VALID_SOS_STATUSES))}",
        )

    old_status = sos.status
    sos.status = target_status

    if assigned_officer_id:
        responder = db.execute(select(Officer).where(Officer.id == assigned_officer_id)).scalar_one_or_none()
        if responder:
            sos.assigned_officer_id = responder.id
            sos.assigned_officer_name = responder.name
    elif not sos.assigned_officer_id:
        sos.assigned_officer_id = current_officer.id
        sos.assigned_officer_name = current_officer.name

    if target_status == "RESOLVED" and note:
        sos.resolution_note = note.strip()

    log_entry = SOSLog(
        sos_id=sos.id,
        actor_name=current_officer.name,
        actor_role=current_officer.role,
        action=f"SOS_{target_status}",
        old_status=old_status,
        new_status=target_status,
        note=note or f"SOS status updated from {old_status} to {target_status} by {current_officer.name}.",
    )
    db.add(log_entry)
    db.commit()
    db.refresh(sos)

    create_notification(
        db=db,
        recipient_role="CITIZEN",
        tracking_id=sos.tracking_id,
        event_type="SOS_UPDATED",
        title=f"SOS Update ({sos.tracking_id}): {target_status}",
        message=note or f"Officer {current_officer.name} updated your emergency alert status to {target_status}.",
    )
    return sos


def cancel_sos_alert_by_citizen(
    db: Session,
    tracking_id: str,
    note: Optional[str] = None,
) -> SOSAlert:
    """Allow citizen to cancel their own SOS alert if activated by mistake."""
    sos = get_sos_by_tracking_id(db, tracking_id)
    if not sos:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SOS alert '{tracking_id}' not found.",
        )

    old_status = sos.status
    sos.status = "CANCELLED"
    log_entry = SOSLog(
        sos_id=sos.id,
        actor_name=sos.citizen_name or "Citizen",
        actor_role="CITIZEN",
        action="SOS_CANCELLED",
        old_status=old_status,
        new_status="CANCELLED",
        note=note or "Cancelled by citizen.",
    )
    db.add(log_entry)
    db.commit()
    db.refresh(sos)
    return sos


# =========================================================================
# 5. Tamil & English Voice Assistant & Speech Processing
# =========================================================================

TAMIL_UNICODE_RE = re.compile(r"[\u0B80-\u0BFF]")
LATIN_RE = re.compile(r"[A-Za-z]")


def detect_speech_language(text: str) -> str:
    """
    Detect whether speech transcript is Tamil ('ta'), English ('en'), or code-switched ('mixed').
    Preserves Tamil Unicode script; never converts Tamil into Tanglish.
    """
    has_tamil = bool(TAMIL_UNICODE_RE.search(text or ""))
    has_latin = bool(LATIN_RE.search(text or ""))
    if has_tamil and has_latin:
        return "mixed"
    if has_tamil:
        return "ta"
    return "en"


def process_voice_input(
    transcript: str,
    preferred_language: str = "en",
) -> Dict[str, Any]:
    """
    Analyze voice transcript (Tamil, English, or mixed):
    - Detects script & language ('ta', 'en', 'mixed') without altering Tamil Unicode script.
    - Checks for navigation / status enquiry voice commands.
    - Runs AI classification preview (category, priority, department).
    - Extracts any mentioned landmark or tracking ID.
    - Generates natural Tamil and English Text-to-Speech (TTS) assistant responses.
    """
    cleaned = (transcript or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Voice transcript cannot be empty.",
        )

    detected_lang = detect_speech_language(cleaned)
    reply_lang = "ta" if (detected_lang == "ta" or preferred_language == "ta") else "en"

    # Check for Case ID or tracking ID enquiry (supports CP-2026-00093, SOS-2026-00001, CP-XXXXXXXX, SOS-XXXXXXXX)
    trk_match = re.search(
        r"\b(CP-\d{4}-\d{4,6}|SOS-\d{4}-\d{4,6}|CP-[A-Z0-9]{6,10}|SOS-[A-Z0-9]{6,10})\b",
        cleaned.upper(),
    )
    extracted_tracking_id = trk_match.group(1) if trk_match else None

    # Detect voice navigation command
    lower_text = cleaned.lower()
    voice_command = "COMPLAINT_DRAFT"
    if any(k in lower_text for k in ["sos", "emergency", "அவசரம்", "ஆபத்து உதவி"]):
        voice_command = "NAVIGATE_SOS"
    elif extracted_tracking_id or any(k in lower_text for k in ["track", "status", "நிலை", "புகார் நிலை"]):
        voice_command = "NAVIGATE_TRACK"
    elif any(k in lower_text for k in ["map", "satellite", "வரைபடம்"]):
        voice_command = "NAVIGATE_MAP"

    # Run classification preview
    classification = classify_complaint(citizen_text=cleaned, voice_transcript=cleaned)
    category = classification.get("category", "Other")
    priority = classification.get("priority", "MEDIUM")
    department = classification.get("department", "General")

    category_ta_map = {
        "Pothole": "சாலைப் பள்ளம் (Pothole)",
        "Garbage": "குப்பை மற்றும் சுகாதாரம் (Garbage)",
        "Water": "குடிநீர் குழாய் கசிவு (Water Supply)",
        "Streetlight": "தெருவிளக்கு பழுது (Streetlight)",
        "Drainage": "சாக்கடை மற்றும் வடிகால் (Drainage)",
        "Other": "பொது நகராட்சி புகார் (Other)",
    }

    if reply_lang == "ta":
        cat_ta = category_ta_map.get(category, category)
        tts_response = (
            f"உங்கள் குரல் பதிவு தமிழ் எழுத்துருவில் பெறப்பட்டது. "
            f"இது '{cat_ta}' பிரிவின் கீழ் '{priority}' முன்னுரிமையுடன் வகைப்படுத்தப்பட்டுள்ளது. "
            f"இடத்தை உறுதிப்படுத்தி புகாரை சமர்ப்பிக்கவும்."
        )
    else:
        tts_response = (
            f"Voice input captured. Classified under '{category}' ({department}) "
            f"with '{priority}' priority. Please confirm your GPS location to submit."
        )

    return {
        "original_transcript": cleaned,
        "detected_language": detected_lang,
        "preserves_tamil_unicode": bool(TAMIL_UNICODE_RE.search(cleaned)),
        "voice_command": voice_command,
        "extracted_tracking_id": extracted_tracking_id,
        "suggested_category": category,
        "suggested_priority": priority,
        "suggested_department": department,
        "ai_source": classification.get("ai_source", "RULE_BASED_FALLBACK"),
        "tts_response": tts_response,
        "tts_language_code": "ta-IN" if reply_lang == "ta" else "en-IN",
    }


# =========================================================================
# 6. Advanced Gemini AI Civic Assistant (Citizen, Worker, Officer, Admin)
# =========================================================================

def _compute_intelligence_metrics(db: Session, current_officer: Optional[Officer] = None) -> Dict[str, Any]:
    """
    Compute real-time complaint intelligence metrics:
    - Overdue / SLA breach count (> 48 hours unresolved)
    - Repeated complaint clusters (duplicate groups)
    - Active SOS count
    - Category & priority breakdown
    """
    now_utc = datetime.now(timezone.utc)
    sla_cutoff = now_utc - timedelta(hours=48)

    all_complaints = db.execute(select(Complaint)).scalars().all()
    total = len(all_complaints)
    open_c = sum(1 for c in all_complaints if c.status == "OPEN")
    in_prog = sum(1 for c in all_complaints if c.status == "IN_PROGRESS")
    resolved = sum(1 for c in all_complaints if c.status == "RESOLVED")
    high_p = sum(1 for c in all_complaints if (c.priority or "").upper() in {"HIGH", "CRITICAL"})

    overdue_items = []
    dup_groups: Dict[str, int] = {}
    for c in all_complaints:
        if c.status not in {"RESOLVED", "REJECTED"}:
            c_time = c.created_at if c.created_at.tzinfo else c.created_at.replace(tzinfo=timezone.utc)
            if c_time < sla_cutoff:
                overdue_items.append(c)
        if c.duplicate_group_id:
            dup_groups[c.duplicate_group_id] = dup_groups.get(c.duplicate_group_id, 0) + 1

    active_sos_count = 0
    if current_officer and current_officer.role.upper() in {"ADMIN", "OFFICER"}:
        active_sos_count = (
            db.execute(
                select(func.count(SOSAlert.id)).where(
                    SOSAlert.status.notin_(["RESOLVED", "CANCELLED"])
                )
            ).scalar_one()
            or 0
        )

    return {
        "total_complaints": total,
        "open_complaints": open_c,
        "in_progress_complaints": in_prog,
        "resolved_complaints": resolved,
        "high_priority_complaints": high_p,
        "overdue_sla_count": len(overdue_items),
        "overdue_sample_ids": [c.tracking_id for c in overdue_items[:5]],
        "duplicate_clusters_count": len(dup_groups),
        "active_sos_count": active_sos_count,
    }


def ask_civic_assistant(
    db: Session,
    prompt: str,
    role_context: str = "CITIZEN",
    language: str = "en",
    tracking_id: Optional[str] = None,
    current_officer: Optional[Officer] = None,
) -> Dict[str, Any]:
    """
    Dedicated Gemini + Deterministic Fallback AI Assistant for Citizen, Worker, Officer, and Admin.
    Never fabricates complaint status or exposes unauthorized data.
    """
    clean_prompt = (prompt or "").strip()
    if not clean_prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assistant prompt cannot be empty.",
        )

    # Enforce strict RBAC on role_context
    effective_role = "CITIZEN"
    if current_officer:
        effective_role = current_officer.role.upper()
    elif role_context.upper() in {"ADMIN", "OFFICER", "WORKER"}:
        # Unauthenticated callers cannot request staff-level intelligence
        effective_role = "CITIZEN"

    detected_lang = detect_speech_language(clean_prompt)
    reply_lang = "ta" if (language == "ta" or detected_lang == "ta") else "en"

    # Extract any Case ID or tracking ID mentioned in the prompt
    trk_match = re.search(
        r"\b(CP-\d{4}-\d{4,6}|SOS-\d{4}-\d{4,6}|CP-[A-Z0-9]{6,10}|SOS-[A-Z0-9]{6,10})\b",
        clean_prompt.upper(),
    )
    lookup_id = (tracking_id or (trk_match.group(1) if trk_match else "")).strip().upper()

    tracked_record_info = None
    if lookup_id.startswith("CP-"):
        comp = db.execute(
            select(Complaint)
            .options(selectinload(Complaint.logs))
            .where(
                or_(
                    func.upper(Complaint.case_id) == lookup_id,
                    func.upper(Complaint.tracking_id) == lookup_id,
                )
            )
        ).scalar_one_or_none()
        if comp:
            tracked_record_info = {
                "type": "COMPLAINT",
                "case_id": comp.case_id or comp.tracking_id,
                "tracking_id": comp.case_id or comp.tracking_id,
                "category": comp.category,
                "priority": comp.priority,
                "department": comp.department,
                "status": comp.status,
                "duplicate_group_id": comp.duplicate_group_id,
                "resolution_note": comp.resolution_note,
                "created_at": str(comp.created_at),
            }
    elif lookup_id.startswith("SOS-"):
        sos = get_sos_by_tracking_id(db, lookup_id)
        if sos:
            tracked_record_info = {
                "type": "SOS",
                "tracking_id": sos.tracking_id,
                "emergency_type": sos.emergency_type,
                "status": sos.status,
                "assigned_officer_name": sos.assigned_officer_name,
                "address_text": sos.address_text,
            }

    metrics = _compute_intelligence_metrics(db, current_officer=current_officer)
    draft_classification = classify_complaint(citizen_text=clean_prompt)

    # Attempt Gemini AI response within 3.5 seconds
    api_key, model_name = get_gemini_config()
    ai_source = "DETERMINISTIC_CIVIC_ENGINE"
    reply_text = ""

    if api_key and not api_key.startswith("your_") and len(api_key) > 10:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            sys_prompt = (
                f"You are CivicPulse AI Assistant for Tamil Nadu municipalities. "
                f"User Role: {effective_role}. Reply Language: {'Tamil (Unicode script)' if reply_lang == 'ta' else 'English'}. "
                f"Live Database Telemetry: {json.dumps(metrics)}. "
                f"Tracked Record (if any): {json.dumps(tracked_record_info)}. "
                f"Draft Triage Suggestion: {json.dumps(draft_classification)}. "
                "Provide a concise, accurate, helpful response based strictly on this real data. Never invent statuses."
            )
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            try:
                fut = executor.submit(
                    client.models.generate_content,
                    model=model_name,
                    contents=f"{sys_prompt}\n\nUser Question: {clean_prompt}",
                )
                resp = fut.result(timeout=3.5)
                text_out = getattr(resp, "text", "") or ""
                if text_out.strip():
                    reply_text = text_out.strip()
                    ai_source = "GEMINI"
            finally:
                executor.shutdown(wait=False, cancel_futures=True)
        except Exception as exc:
            logger.warning("Gemini assistant fallback triggered: %s", exc)

    # Deterministic, data-backed bilingual fallback if Gemini is unavailable
    if not reply_text:
        if tracked_record_info:
            if tracked_record_info["type"] == "COMPLAINT":
                if reply_lang == "ta":
                    reply_text = (
                        f"புகார் எண் {tracked_record_info['tracking_id']} விவரம்:\n"
                        f"• பிரிவு: {tracked_record_info['category']} ({tracked_record_info['department']})\n"
                        f"• முன்னுரிமை: {tracked_record_info['priority']}\n"
                        f"• தற்போதைய நிலை: {tracked_record_info['status']}\n"
                        + (f"• தீர்வு குறிப்பு: {tracked_record_info['resolution_note']}" if tracked_record_info.get("resolution_note") else "• அதிகாரிகள் நடவடிக்கை எடுத்து வருகின்றனர்.")
                    )
                else:
                    reply_text = (
                        f"Tracking Status for {tracked_record_info['tracking_id']}:\n"
                        f"• Category: {tracked_record_info['category']} ({tracked_record_info['department']})\n"
                        f"• Priority: {tracked_record_info['priority']}\n"
                        f"• Current Status: {tracked_record_info['status']}\n"
                        + (f"• Resolution Note: {tracked_record_info['resolution_note']}" if tracked_record_info.get("resolution_note") else "• Assigned municipal team is processing this issue.")
                    )
            else:
                reply_text = (
                    f"SOS Emergency {tracked_record_info['tracking_id']} ({tracked_record_info['emergency_type']}) "
                    f"is currently {tracked_record_info['status']} at {tracked_record_info['address_text']}."
                )
        elif effective_role == "ADMIN":
            if reply_lang == "ta":
                reply_text = (
                    f"நகராட்சி நிர்வாக நுண்ணறிவு சுருக்கம்:\n"
                    f"• மொத்த புகார்கள்: {metrics['total_complaints']} (திறந்தவை: {metrics['open_complaints']}, செயல்பாட்டில்: {metrics['in_progress_complaints']}, தீர்க்கப்பட்டவை: {metrics['resolved_complaints']})\n"
                    f"• அதிக முன்னுரிமை புகார்கள்: {metrics['high_priority_complaints']}\n"
                    f"• காலாவதியான (SLA > 48 மணிநேரம்) புகார்கள்: {metrics['overdue_sla_count']}\n"
                    f"• ஒரே பகுதியின் இரட்டைப் புகார் குழுக்கள்: {metrics['duplicate_clusters_count']}\n"
                    f"• செயலில் உள்ள SOS அவசர அழைப்புகள்: {metrics['active_sos_count']}"
                )
            else:
                reply_text = (
                    f"Executive Municipal Intelligence Summary:\n"
                    f"• Total Complaints: {metrics['total_complaints']} (Open: {metrics['open_complaints']}, In Progress: {metrics['in_progress_complaints']}, Resolved: {metrics['resolved_complaints']})\n"
                    f"• High-Priority Issues: {metrics['high_priority_complaints']}\n"
                    f"• Overdue SLA (>48h) Complaints: {metrics['overdue_sla_count']} ({', '.join(metrics['overdue_sample_ids'][:3]) or 'None'})\n"
                    f"• Active Duplicate Clusters: {metrics['duplicate_clusters_count']}\n"
                    f"• Active Emergency SOS Incidents: {metrics['active_sos_count']}"
                )
        elif effective_role in {"OFFICER", "WORKER"}:
            if reply_lang == "ta":
                reply_text = (
                    f"கள அதிகாரி பணிச் சுருக்கம் ({current_officer.department if current_officer else 'Municipal'}):\n"
                    f"• அதிக முன்னுரிமை புகார்கள் ({metrics['high_priority_complaints']}) மற்றும் 48 மணிநேரத்திற்கு மேலான புகார்களுக்கு ({metrics['overdue_sla_count']}) முன்னுரிமை அளிக்கவும்.\n"
                    f"• பரிந்துரைக்கப்பட்ட பிரிவு: {draft_classification['category']} ({draft_classification['priority']} முன்னுரிமை)."
                )
            else:
                reply_text = (
                    f"Field Operations Assistant ({current_officer.department if current_officer else 'Municipal'}):\n"
                    f"• Prioritize HIGH severity issues ({metrics['high_priority_complaints']} total) and SLA-overdue tickets ({metrics['overdue_sla_count']} > 48h).\n"
                    f"• Triage Analysis of your query: Category '{draft_classification['category']}', Priority '{draft_classification['priority']}', Department '{draft_classification['department']}'.\n"
                    f"• Reminder: Upload a verified field resolution photo (<= 5 MB) and inspection note before marking any task RESOLVED."
                )
        else:
            # Citizen assistant response
            if reply_lang == "ta":
                reply_text = (
                    f"CivicPulse AI குடிமக்கள் உதவி மையம்:\n"
                    f"• உங்கள் செய்தி '{draft_classification['category']}' ({draft_classification['department']}) பிரிவின் கீழ் '{draft_classification['priority']}' முன்னுரிமையாக அடையாளம் காணப்பட்டுள்ளது.\n"
                    f"• புகார் அளிக்க: 'புகார் பதிவு' பக்கத்தில் புகைப்படம் மற்றும் ஜிபிஎஸ் இருப்பிடத்துடன் சமர்ப்பிக்கவும்.\n"
                    f"• அவசர பொதுப் பாதுகாப்பு ஆபத்துகளுக்கு: சிவப்பு நிற 'SOS அவசர உதவி' பொத்தானை பயன்படுத்தவும்."
                )
            else:
                reply_text = (
                    f"CivicPulse AI Citizen Assistant:\n"
                    f"• Triage Suggestion: Your description matches '{draft_classification['category']}' ({draft_classification['department']}) with '{draft_classification['priority']}' priority.\n"
                    f"• Next Step: Attach a photo and confirm your GPS pin in the Report screen to receive a unique CP-XXXXXXXX tracking ID.\n"
                    f"• Public Safety Hazard: If there is an immediate danger (open manhole, live wire, fire, flooding), use the SOS Emergency channel."
                )

    return {
        "reply": reply_text,
        "language": reply_lang,
        "role_context": effective_role,
        "ai_source": ai_source,
        "suggested_classification": draft_classification,
        "tracked_record": tracked_record_info,
        "live_metrics": metrics,
    }
