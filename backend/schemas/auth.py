import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginRequest(BaseModel):
    """Schema for officer and admin login."""
    email: str = Field(..., description="Registered officer email address")
    password: str = Field(..., description="Account password")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", trimmed):
            raise ValueError("Invalid email address format.")
        return trimmed


class TokenResponse(BaseModel):
    """Schema for JWT token issuance response."""
    access_token: str
    token_type: str = "bearer"
    role: str
    department: str
    name: str


class OfficerCreate(BaseModel):
    """Schema for administrative creation of a new officer account."""
    name: str = Field(..., min_length=2, description="Officer full name")
    email: str = Field(..., description="Officer official email address")
    password: str = Field(..., min_length=6, description="Password (at least 6 characters)")
    department: str = Field(..., min_length=2, description="Assigned municipal department")
    role: str = Field(default="OFFICER", description="Role: 'OFFICER' or 'ADMIN'")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", trimmed):
            raise ValueError("Invalid email format.")
        return trimmed

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        role_upper = v.strip().upper()
        if role_upper not in {"OFFICER", "ADMIN"}:
            raise ValueError("Role must be either 'OFFICER' or 'ADMIN'.")
        return role_upper


class OfficerResponse(BaseModel):
    """Schema for returning officer public profile (never includes hashed password)."""
    id: int
    name: str
    email: str
    department: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OfficerListResponse(BaseModel):
    """Schema for returning a list of officers."""
    total: int
    items: List[OfficerResponse]

    model_config = ConfigDict(from_attributes=True)


class ComplaintAssignRequest(BaseModel):
    """Schema for admin complaint assignment request."""
    officer_id: int = Field(..., description="ID of the municipal officer to assign")
    note: Optional[str] = Field(default=None, description="Optional assignment notes or remarks")


class ComplaintStatusUpdateRequest(BaseModel):
    """Schema for officer status change request."""
    status: str = Field(
        ...,
        description="Target status: 'IN_PROGRESS', 'NEEDS_INFO', 'RESOLVED', 'REJECTED'",
    )
    note: Optional[str] = Field(default=None, description="Status change reason or log note")
    resolution_note: Optional[str] = Field(
        default=None,
        description="Detailed resolution summary when resolving issue",
    )
    resolution_photo_url: Optional[str] = Field(
        default=None,
        description="Proof of work resolution photo URL",
    )

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        st = v.strip().upper()
        valid = {"OPEN", "IN_PROGRESS", "NEEDS_INFO", "RESOLVED", "REJECTED"}
        if st not in valid:
            raise ValueError(f"Status must be one of {valid}")
        return st

