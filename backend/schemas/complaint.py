from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ComplaintCreate(BaseModel):
    """
    Schema for citizen complaint creation request.
    Validates non-empty text and geographic coordinate bounds.
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
    Schema representing the complete complaint entity including audit logs.
    """
    id: int
    tracking_id: str
    citizen_text: str
    voice_transcript: Optional[str] = None
    category: str
    priority: str
    department: str
    ai_source: str
    latitude: float
    longitude: float
    photo_url: Optional[str] = None
    status: str
    duplicate_group_id: Optional[str] = None
    duplicate_confidence: Optional[float] = None
    resolution_photo_url: Optional[str] = None
    resolution_note: Optional[str] = None
    assigned_officer_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    logs: List[ComplaintLogResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ComplaintListResponse(BaseModel):
    """
    Schema for paginated complaints listing with metadata.
    """
    total: int
    items: List[ComplaintResponse]
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)
