from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    TypeDecorator,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class TZDateTime(TypeDecorator):
    """
    Timezone-aware DateTime type decorator.
    Ensures datetime values retain UTC tzinfo across SQLite and PostgreSQL.
    """
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value: Optional[datetime], dialect) -> Optional[datetime]:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class Officer(Base):
    """
    Officer model representing authorized municipal personnel (ADMIN, OFFICER, WORKER).
    """
    __tablename__ = "officers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="OFFICER")  # ADMIN, OFFICER, or WORKER
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        default=utc_now,
        nullable=False,
    )

    # One-to-many relationship with assigned complaints
    assigned_complaints: Mapped[List["Complaint"]] = relationship(
        "Complaint",
        back_populates="assigned_officer",
        foreign_keys="Complaint.assigned_officer_id",
    )


class CaseSequence(Base):
    """
    Atomic database sequence counter for unified Case IDs (CP-YYYY-NNNNN and SOS-YYYY-NNNNN).
    Guarantees monotonic, collision-free sequential numbering per prefix and year.
    """
    __tablename__ = "case_sequences"

    prefix: Mapped[str] = mapped_column(String(20), primary_key=True)
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Complaint(Base):
    """
    Complaint model representing civic issues submitted by citizens.
    Tracks issue details, location coordinates, triage status, duplicate grouping,
    officer assignment, and field worker evidence.
    """
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    tracking_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    citizen_token: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    citizen_text: Mapped[str] = mapped_column(Text, nullable=False)
    voice_transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="Other")
    priority: Mapped[str] = mapped_column(String(50), nullable=False, default="Medium")
    department: Mapped[str] = mapped_column(String(100), nullable=False, default="General")
    ai_source: Mapped[str] = mapped_column(String(50), nullable=False, default="RULE_BASED_FALLBACK")
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="OPEN")
    duplicate_group_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    duplicate_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    resolution_photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_officer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("officers.id"),
        nullable=True,
        index=True,
    )
    assigned_worker_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )
    worker_before_photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    worker_after_photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    worker_completion_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # One-to-many bidirectional relationship with ComplaintLog audit entries
    logs: Mapped[List["ComplaintLog"]] = relationship(
        "ComplaintLog",
        back_populates="complaint",
        cascade="all, delete-orphan",
    )

    # Many-to-one relationship with assigned Officer
    assigned_officer: Mapped[Optional["Officer"]] = relationship(
        "Officer",
        back_populates="assigned_complaints",
        foreign_keys=[assigned_officer_id],
    )


class ComplaintLog(Base):
    """
    ComplaintLog model tracking audit history and lifecycle events
    for each complaint (creation, status update, worker completion, resolution, etc.).
    """
    __tablename__ = "complaint_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    complaint_id: Mapped[int] = mapped_column(
        ForeignKey("complaints.id"),
        index=True,
        nullable=False,
    )
    actor_name: Mapped[str] = mapped_column(String(100), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    old_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    officer_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        TZDateTime,
        default=utc_now,
        nullable=False,
    )

    # Many-to-one bidirectional relationship with parent Complaint
    complaint: Mapped["Complaint"] = relationship(
        "Complaint",
        back_populates="logs",
    )


class SOSAlert(Base):
    """
    SOSAlert model representing high-priority public safety emergency incidents.
    Restricted from public listing; visible only to authenticated officers/admins
    and trackable by the citizen via its unique SOS tracking ID.
    """
    __tablename__ = "sos_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    tracking_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    emergency_type: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="SUBMITTED")
    priority: Mapped[str] = mapped_column(String(50), nullable=False, default="CRITICAL")
    citizen_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    citizen_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    trusted_contacts_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_officer_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    assigned_officer_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    logs: Mapped[List["SOSLog"]] = relationship(
        "SOSLog",
        back_populates="sos_alert",
        cascade="all, delete-orphan",
    )


class SOSLog(Base):
    """Audit trail log entry for an SOS emergency alert."""
    __tablename__ = "sos_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sos_id: Mapped[int] = mapped_column(
        ForeignKey("sos_alerts.id"),
        index=True,
        nullable=False,
    )
    actor_name: Mapped[str] = mapped_column(String(100), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    old_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(TZDateTime, default=utc_now, nullable=False)

    sos_alert: Mapped["SOSAlert"] = relationship("SOSAlert", back_populates="logs")


class CivicNotification(Base):
    """
    In-app and polling notification model for real-time complaint and SOS updates.
    """
    __tablename__ = "civic_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipient_role: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    recipient_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    tracking_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=utc_now, nullable=False)
