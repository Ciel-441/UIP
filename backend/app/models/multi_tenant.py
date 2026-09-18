"""Multi-tenant Data Room models – rooms, memberships, and invite codes."""

import enum
import secrets
from datetime import datetime, timedelta

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class RoomRole(str, enum.Enum):
    """Hierarchical role within a Data Room."""
    admin = "admin"
    editor = "editor"
    analyst = "analyst"
    viewer = "viewer"


class MembershipStatus(str, enum.Enum):
    """Status of a user's membership in a Data Room."""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    banned = "banned"


class DataRoom(Base):
    """An isolated workspace (tenant) containing its own documents, graph, and settings."""
    __tablename__ = "data_rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by], backref="created_rooms")
    memberships = relationship("RoomMembership", back_populates="room", cascade="all, delete-orphan")
    invite_codes = relationship("InviteCode", back_populates="room", cascade="all, delete-orphan")
    groups = relationship("RoomGroup", back_populates="room", cascade="all, delete-orphan")


class RoomMembership(Base):
    """Links a user to a Data Room with a specific role and approval status."""
    __tablename__ = "room_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "room_id", name="uq_user_room"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(RoomRole), default=RoomRole.viewer, nullable=False)
    status = Column(Enum(MembershipStatus), default=MembershipStatus.pending, nullable=False)
    joined_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    user = relationship("User", backref="room_memberships")
    room = relationship("DataRoom", back_populates="memberships")


class InviteCode(Base):
    """A secure, time-limited, usage-limited code for joining a Data Room."""
    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, index=True, nullable=False, default=lambda: secrets.token_urlsafe(24))
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    max_uses = Column(Integer, default=10)
    uses = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    room = relationship("DataRoom", back_populates="invite_codes")
    creator = relationship("User", foreign_keys=[created_by])

    @property
    def is_valid(self) -> bool:
        """Check if this invite code is still usable."""
        if self.is_revoked:
            return False
        if self.uses >= self.max_uses:
            return False
        if datetime.utcnow() > self.expires_at:
            return False
        return True


class RoomGroup(Base):
    """A team/group within a Data Room for organizing members."""
    __tablename__ = "room_groups"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    room = relationship("DataRoom", back_populates="groups")
    members = relationship("RoomGroupMember", back_populates="group", cascade="all, delete-orphan")


class RoomGroupMember(Base):
    """Associates a user with a RoomGroup."""
    __tablename__ = "room_group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("room_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    added_at = Column(DateTime, default=func.now())

    # Relationships
    group = relationship("RoomGroup", back_populates="members")
    user = relationship("User")
