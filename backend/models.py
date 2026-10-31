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
    Officer model representing authorized municipal personnel and administrators.
    """
    __tablename__ = "officers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="OFFICER")  # ADMIN or OFFICER
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
    )


class Complaint(Base):
    """
    Complaint model representing civic issues submitted by citizens.
    Tracks issue details, location coordinates, triage status, and duplicate grouping.
    """
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tracking_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    citizen_text: Mapped[str] = mapped_column(Text, nullable=False)
    voice_transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="Other")
    priority: Mapped[str] = mapped_column(String(50), nullable=False, default="Medium")
    department: Mapped[str] = mapped_column(String(100), nullable=False, default="General")
    ai_source: Mapped[str] = mapped_column(String(50), nullable=False, default="RULE_BASED_FALLBACK")
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
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
    )


class ComplaintLog(Base):
    """
    ComplaintLog model tracking audit history and lifecycle events
    for each complaint (creation, status update, resolution, etc.).
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
