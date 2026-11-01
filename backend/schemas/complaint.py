from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ComplaintCreate(BaseModel):
    """
    Schema for citizen complaint creation request.
    Validates non-empty text, geographic coordinate bounds, and optional idempotency key.
    """
    citizen_text: str = Field(
        ...,
        min_length=1,
        description="Detailed text description of the civic issue submitted by the citizen",
    )
    voice_transcript: Optional[str] = Field(
        default=None,
        description="Optional voice transcription text in English or Tamil",
    )
    latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="GPS Latitude coordinate (-90 to 90)",
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="GPS Longitude coordinate (-180 to 180)",
    )
    address_text: Optional[str] = Field(
        default=None,
        description="Optional reverse-geocoded street or ward address",
    )
    idempotency_key: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Optional client idempotency key to prevent duplicate creation on network retries",
    )
    is_private: bool = Field(
        default=False,
        description="Whether this complaint is restricted from public enumeration without Case ID/token",
    )

    @field_validator("citizen_text")
    @classmethod
    def validate_non_empty_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Complaint description cannot be empty or solely whitespace.")
        return trimmed


class ComplaintLogResponse(BaseModel):
    """
    Schema representing an audit trail entry for a complaint.
    """
    id: int
    complaint_id: int
    actor_name: str
    actor_role: str
    action: str
    note: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    officer_id: Optional[int] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ComplaintResponse(BaseModel):
    """
    Schema representing the complete complaint entity including Unified Case ID and audit logs.
    """
    id: int
    case_id: str
    tracking_id: str
    citizen_text: str
    voice_transcript: Optional[str] = None
    category: str
    priority: str
    department: str
    ai_source: str
    latitude: float
    longitude: float
    address_text: Optional[str] = None
    photo_url: Optional[str] = None
    status: str
    is_private: bool = False
    citizen_token: Optional[str] = None
    duplicate_group_id: Optional[str] = None
    duplicate_confidence: Optional[float] = None
    resolution_photo_url: Optional[str] = None
    resolution_note: Optional[str] = None
    assigned_officer_id: Optional[int] = None
    assigned_worker_id: Optional[int] = None
    worker_before_photo_url: Optional[str] = None
    worker_after_photo_url: Optional[str] = None
    worker_completion_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    logs: List[ComplaintLogResponse] = []

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def ensure_case_id_populated(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("case_id") and data.get("tracking_id"):
                data["case_id"] = data["tracking_id"]
            return data
        # ORM object
        cid = getattr(data, "case_id", None)
        if not cid:
            trk = getattr(data, "tracking_id", None)
            if trk:
                try:
                    setattr(data, "case_id", trk)
                except Exception:
                    pass
        return data


class ComplaintListResponse(BaseModel):
    """
    Schema for paginated complaints listing with metadata.
    """
    total: int
    items: List[ComplaintResponse]
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)


class PublicStatsResponse(BaseModel):
    """
    Schema for public aggregate statistics across the municipal database.
    """
    total_complaints: int
    open_complaints: int
    in_progress_complaints: int
    resolved_complaints: int
    high_priority_complaints: int
    resolution_rate_pct: float = 0.0
    category_distribution: Dict[str, int]

    model_config = ConfigDict(from_attributes=True)
