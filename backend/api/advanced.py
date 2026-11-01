import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm import Session

from database import get_db
from models import Officer
from schemas.auth import OfficerListResponse, WorkerAssignRequest
from schemas.complaint import ComplaintListResponse, ComplaintResponse
from services import advanced_service
from services.auth_service import (
    get_optional_officer,
    require_officer_or_admin,
    require_worker_or_officer_or_admin,
)

router = APIRouter(tags=["Advanced GIS, Voice, AI Assistant, SOS & Worker Operations"])


# =========================================================================
# Pydantic Schemas for Advanced Endpoints
# =========================================================================

class VoiceProcessRequest(BaseModel):
    transcript: str = Field(..., min_length=1, description="Spoken Tamil, English, or mixed transcript")
    preferred_language: str = Field(default="en", description="'en' or 'ta'")


class AIAssistantRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Question or complaint draft in Tamil or English")
    role_context: str = Field(default="CITIZEN", description="'CITIZEN', 'WORKER', 'OFFICER', or 'ADMIN'")
    language: str = Field(default="en", description="'en' or 'ta'")
    tracking_id: Optional[str] = Field(default=None, description="Optional CP-XXXXXXXX or SOS-XXXXXXXX tracking ID")


class SOSCreateRequest(BaseModel):
    emergency_type: str = Field(..., min_length=2, description="Emergency hazard category")
    description: str = Field(..., min_length=3, description="Emergency situation details")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    address_text: Optional[str] = None
    citizen_name: Optional[str] = Field(default="Citizen")
    citizen_phone: Optional[str] = None
    trusted_contacts: Optional[List[Dict[str, str]]] = None


class SOSStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="SUBMITTED, ACKNOWLEDGED, OFFICER_ASSIGNED, RESPONDING, RESOLVED, CANCELLED")
    note: Optional[str] = None
    assigned_officer_id: Optional[int] = None


class SOSCancelRequest(BaseModel):
    note: Optional[str] = Field(default="Cancelled by citizen.")


class SOSLogResponse(BaseModel):
    id: int
    sos_id: int
    actor_name: str
    actor_role: str
    action: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    note: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class SOSAlertResponse(BaseModel):
    id: int
    case_id: str
    sos_id: str
    tracking_id: str
    emergency_type: str
    description: str
    latitude: float
    longitude: float
    address_text: Optional[str] = None
    photo_url: Optional[str] = None
    status: str
    priority: str
    citizen_name: Optional[str] = None
    citizen_phone: Optional[str] = None
    assigned_officer_id: Optional[int] = None
    assigned_officer_name: Optional[str] = None
    resolution_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    logs: List[SOSLogResponse] = []

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def populate_sos_case_ids(cls, data: Any) -> Any:
        if isinstance(data, dict):
            trk = data.get("case_id") or data.get("tracking_id")
            if trk:
                data.setdefault("case_id", trk)
                data.setdefault("sos_id", trk)
            return data
        trk = getattr(data, "case_id", None) or getattr(data, "tracking_id", None)
        if trk:
            try:
                setattr(data, "case_id", trk)
                setattr(data, "sos_id", trk)
            except Exception:
                pass
        return data


class SOSListResponse(BaseModel):
    total: int
    items: List[SOSAlertResponse]


class NotificationResponse(BaseModel):
    id: int
    recipient_role: str
    recipient_id: Optional[int] = None
    tracking_id: Optional[str] = None
    event_type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================================
# 1. Live Satellite GIS, Reverse Geocoding, Nearby & Route Endpoints
# =========================================================================

@router.get("/gis/reverse-geocode", summary="Reverse geocode GPS coordinates into readable address")
def reverse_geocode_endpoint(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    lang: str = Query("en", description="Language preference: 'en' or 'ta'"),
):
    return advanced_service.reverse_geocode_coordinates(latitude=latitude, longitude=longitude, lang=lang)


@router.get("/gis/nearby", summary="Find civic complaints within configurable distance of GPS coordinates")
def get_nearby_complaints_endpoint(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(2.0, ge=0.1, le=50.0, description="Search radius in kilometres"),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    items = advanced_service.get_nearby_complaints(
        db=db,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        category=category,
        status_filter=status,
        limit=limit,
    )
    return {
        "center": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km,
        "total": len(items),
        "items": items,
    }


@router.get("/gis/route-estimate", summary="Calculate route distance, compass bearing, and ETA to complaint")
def estimate_route_endpoint(
    from_lat: float = Query(..., ge=-90.0, le=90.0),
    from_lon: float = Query(..., ge=-180.0, le=180.0),
    to_lat: float = Query(..., ge=-90.0, le=90.0),
    to_lon: float = Query(..., ge=-180.0, le=180.0),
):
    return advanced_service.estimate_navigation_route(
        from_lat=from_lat,
        from_lon=from_lon,
        to_lat=to_lat,
        to_lon=to_lon,
    )


# =========================================================================
# 2. Tamil & English Voice Assistant Endpoint
# =========================================================================

@router.post("/voice/process", summary="Process Tamil/English voice transcript and generate TTS response")
def process_voice_endpoint(req: VoiceProcessRequest):
    return advanced_service.process_voice_input(
        transcript=req.transcript,
        preferred_language=req.preferred_language,
    )


# =========================================================================
# 3. Advanced Gemini AI Civic Assistant Endpoints
# =========================================================================

@router.post("/ai/assistant", summary="Interactive Gemini AI Civic Assistant for Citizen, Worker, Officer, Admin")
def civic_ai_assistant_endpoint(
    req: AIAssistantRequest,
    current_officer: Optional[Officer] = Depends(get_optional_officer),
    db: Session = Depends(get_db),
):
    return advanced_service.ask_civic_assistant(
        db=db,
        prompt=req.prompt,
        role_context=req.role_context,
        language=req.language,
        tracking_id=req.tracking_id,
        current_officer=current_officer,
    )


@router.get("/ai/intelligence-summary", summary="Get SLA overdue, duplicate clusters, and priority intelligence")
def get_intelligence_summary_endpoint(
    current_officer: Officer = Depends(require_officer_or_admin),
    db: Session = Depends(get_db),
):
    return advanced_service._compute_intelligence_metrics(db=db, current_officer=current_officer)


# =========================================================================
# 4. SOS Emergency Response Endpoints
# =========================================================================

@router.post(
    "/sos",
    response_model=SOSAlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an emergency SOS alert (JSON)",
)
async def create_sos_json_endpoint(
    sos_in: SOSCreateRequest,
    db: Session = Depends(get_db),
):
    sos = advanced_service.create_sos_alert(
        db=db,
        emergency_type=sos_in.emergency_type,
        description=sos_in.description,
        latitude=sos_in.latitude,
        longitude=sos_in.longitude,
        citizen_name=sos_in.citizen_name,
        citizen_phone=sos_in.citizen_phone,
        address_text=sos_in.address_text,
        trusted_contacts=sos_in.trusted_contacts,
    )
    await advanced_service.broadcaster.broadcast(
        {
            "event": "SOS_RECEIVED",
            "tracking_id": sos.tracking_id,
            "emergency_type": sos.emergency_type,
            "latitude": sos.latitude,
            "longitude": sos.longitude,
            "status": sos.status,
        }
    )
    return sos


@router.post(
    "/sos/with-photo",
    response_model=SOSAlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an emergency SOS alert with optional photo (Multipart)",
)
async def create_sos_multipart_endpoint(
    emergency_type: str = Form(...),
    description: str = Form(...),
    latitude: float = Form(..., ge=-90.0, le=90.0),
    longitude: float = Form(..., ge=-180.0, le=180.0),
    address_text: Optional[str] = Form(None),
    citizen_name: Optional[str] = Form("Citizen"),
    citizen_phone: Optional[str] = Form(None),
    trusted_contacts_json: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    photo_bytes: Optional[bytes] = None
    photo_name: Optional[str] = None
    photo_mime: Optional[str] = None
    if photo and photo.filename:
        raw = await photo.read()
        if len(raw) > 0:
            photo_bytes = raw
            photo_name = photo.filename
            photo_mime = photo.content_type

    trusted_list = None
    if trusted_contacts_json:
        try:
            trusted_list = json.loads(trusted_contacts_json)
        except Exception:
            trusted_list = None

    sos = advanced_service.create_sos_alert(
        db=db,
        emergency_type=emergency_type,
        description=description,
        latitude=latitude,
        longitude=longitude,
        citizen_name=citizen_name,
        citizen_phone=citizen_phone,
        address_text=address_text,
        trusted_contacts=trusted_list,
        photo_bytes=photo_bytes,
        photo_filename=photo_name,
        photo_mime=photo_mime,
    )
    await advanced_service.broadcaster.broadcast(
        {
            "event": "SOS_RECEIVED",
            "tracking_id": sos.tracking_id,
            "emergency_type": sos.emergency_type,
            "latitude": sos.latitude,
            "longitude": sos.longitude,
            "status": sos.status,
        }
    )
    return sos


@router.get(
    "/sos/track/{tracking_id}",
    response_model=SOSAlertResponse,
    summary="Track SOS emergency alert status by unique SOS tracking ID",
)
def track_sos_endpoint(
    tracking_id: str = Path(..., description="Unique SOS tracking ID (e.g. SOS-A1B2C3D4)"),
    db: Session = Depends(get_db),
):
    sos = advanced_service.get_sos_by_tracking_id(db=db, tracking_id=tracking_id)
    if not sos:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SOS alert '{tracking_id}' not found.",
        )
    return sos


@router.patch(
    "/sos/track/{tracking_id}/cancel",
    response_model=SOSAlertResponse,
    summary="Cancel an accidental SOS alert using its tracking ID",
)
@router.post(
    "/sos/track/{tracking_id}/cancel",
    response_model=SOSAlertResponse,
    summary="Cancel an accidental SOS alert using its tracking ID (POST)",
)
async def cancel_sos_endpoint(
    tracking_id: str = Path(...),
    req: Optional[SOSCancelRequest] = None,
    db: Session = Depends(get_db),
):
    sos = advanced_service.cancel_sos_alert_by_citizen(
        db=db,
        tracking_id=tracking_id,
        note=req.note if req else "Cancelled by citizen.",
    )
    await advanced_service.broadcaster.broadcast(
        {"event": "SOS_UPDATED", "tracking_id": sos.tracking_id, "status": sos.status}
    )
    return sos


@router.get(
    "/sos",
    response_model=SOSListResponse,
    summary="List SOS alerts for restricted Officer & Admin emergency dashboard",
)
def list_sos_alerts_endpoint(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_officer: Officer = Depends(require_officer_or_admin),
    db: Session = Depends(get_db),
):
    total, items = advanced_service.list_sos_alerts(db=db, status_filter=status, limit=limit)
    return SOSListResponse(total=total, items=items)


@router.patch(
    "/sos/{sos_id}/status",
    response_model=SOSAlertResponse,
    summary="Acknowledge, assign, or resolve an SOS alert (Authorized Officer/Admin only)",
)
async def update_sos_status_endpoint(
    sos_id: int = Path(..., ge=1),
    req: SOSStatusUpdateRequest = ...,
    current_officer: Officer = Depends(require_officer_or_admin),
    db: Session = Depends(get_db),
):
    sos = advanced_service.update_sos_status(
        db=db,
        sos_id=sos_id,
        current_officer=current_officer,
        new_status=req.status,
        note=req.note,
        assigned_officer_id=req.assigned_officer_id,
    )
    await advanced_service.broadcaster.broadcast(
        {"event": "SOS_UPDATED", "tracking_id": sos.tracking_id, "status": sos.status}
    )
    return sos


# =========================================================================
# 5. Field Worker Role & Worker Dashboard Endpoints
# =========================================================================

@router.get(
    "/officer/workers",
    response_model=OfficerListResponse,
    summary="List active municipal field workers (Officer or Admin)",
)
def list_workers_endpoint(
    department: Optional[str] = Query(None),
    current_officer: Officer = Depends(require_officer_or_admin),
    db: Session = Depends(get_db),
):
    workers = advanced_service.list_workers(db=db, department=department)
    return OfficerListResponse(total=len(workers), items=workers)


@router.patch(
    "/officer/complaints/{complaint_id}/assign-worker",
    response_model=ComplaintResponse,
    summary="Dispatch and assign a field worker to a complaint (Officer or Admin)",
)
async def assign_worker_endpoint(
    complaint_id: int = Path(..., ge=1),
    req: WorkerAssignRequest = ...,
    current_officer: Officer = Depends(require_officer_or_admin),
    db: Session = Depends(get_db),
):
    comp = advanced_service.assign_worker_to_complaint(
        db=db,
        complaint_id=complaint_id,
        worker_id=req.worker_id,
        current_officer=current_officer,
        note=req.note,
    )
    await advanced_service.broadcaster.broadcast(
        {
            "event": "WORKER_ASSIGNED",
            "tracking_id": comp.tracking_id,
            "complaint_id": comp.id,
            "assigned_worker_id": comp.assigned_worker_id,
        }
    )
    return comp


@router.get(
    "/worker/complaints",
    response_model=ComplaintListResponse,
    summary="Get assigned field tasks for logged-in Worker (or Officer/Admin)",
)
def get_worker_tasks_endpoint(
    status: Optional[str] = Query(None),
    current_user: Officer = Depends(require_worker_or_officer_or_admin),
    db: Session = Depends(get_db),
):
    total, items = advanced_service.get_worker_complaints(
        db=db,
        current_user=current_user,
        status_filter=status,
    )
    return ComplaintListResponse(total=total, items=items, skip=0, limit=max(total, 20))


@router.patch(
    "/worker/complaints/{complaint_id}/progress",
    response_model=ComplaintResponse,
    summary="Submit field worker status update, before/after photos, and inspection notes",
)
@router.post(
    "/worker/complaints/{complaint_id}/progress",
    response_model=ComplaintResponse,
    summary="Submit field worker status update, before/after photos, and inspection notes (POST)",
)
async def submit_worker_progress_endpoint(
    complaint_id: int = Path(..., ge=1),
    work_status: str = Form("IN_PROGRESS", description="IN_PROGRESS or WORK_COMPLETED"),
    completion_note: str = Form(..., description="Field inspection or completion notes"),
    before_photo: Optional[UploadFile] = File(None),
    after_photo: Optional[UploadFile] = File(None),
    current_worker: Officer = Depends(require_worker_or_officer_or_admin),
    db: Session = Depends(get_db),
):
    b_bytes = await before_photo.read() if (before_photo and before_photo.filename) else None
    a_bytes = await after_photo.read() if (after_photo and after_photo.filename) else None

    comp = advanced_service.update_worker_field_work(
        db=db,
        complaint_id=complaint_id,
        current_worker=current_worker,
        work_status=work_status,
        completion_note=completion_note,
        before_bytes=b_bytes,
        before_filename=before_photo.filename if before_photo else None,
        before_mime=before_photo.content_type if before_photo else None,
        after_bytes=a_bytes,
        after_filename=after_photo.filename if after_photo else None,
        after_mime=after_photo.content_type if after_photo else None,
    )
    await advanced_service.broadcaster.broadcast(
        {
            "event": "WORKER_PROGRESS",
            "tracking_id": comp.tracking_id,
            "complaint_id": comp.id,
            "status": comp.status,
        }
    )
    return comp


# =========================================================================
# 6. Real-Time Notifications & WebSocket Feed
# =========================================================================

@router.get(
    "/notifications",
    response_model=List[NotificationResponse],
    summary="Poll recent civic and emergency notifications",
)
def get_notifications_endpoint(
    tracking_id: Optional[str] = Query(None, description="Citizen complaint or SOS tracking ID"),
    limit: int = Query(25, ge=1, le=100),
    current_user: Optional[Officer] = Depends(get_optional_officer),
    db: Session = Depends(get_db),
):
    role = current_user.role if current_user else ("CITIZEN" if tracking_id else None)
    recipient_id = current_user.id if current_user else None
    return advanced_service.get_notifications(
        db=db,
        role=role,
        recipient_id=recipient_id,
        tracking_id=tracking_id,
        limit=limit,
    )


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a notification as read",
)
def mark_notification_read_endpoint(
    notification_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    notif = advanced_service.mark_notification_read(db=db, notification_id=notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return notif


@router.websocket("/ws/updates")
async def websocket_updates_endpoint(websocket: WebSocket):
    """Real-time WebSocket stream broadcasting new complaints, status changes, and SOS alerts."""
    await advanced_service.broadcaster.connect(websocket)
    try:
        await websocket.send_text(
            json.dumps({"event": "CONNECTED", "service": "CivicPulse AI Live Stream"})
        )
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text(json.dumps({"event": "PONG"}))
    except WebSocketDisconnect:
        advanced_service.broadcaster.disconnect(websocket)
    except Exception:
        advanced_service.broadcaster.disconnect(websocket)

