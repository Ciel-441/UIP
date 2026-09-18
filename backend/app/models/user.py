from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class BlockedUser(Base):
    __tablename__ = "blocked_users"
    id = Column(Integer, primary_key=True, index=True)
    blocker_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    blocked_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=func.now())
    
    blocker = relationship("User", foreign_keys=[blocker_id], backref="blocking")
    blocked = relationship("User", foreign_keys=[blocked_id], backref="blocked_by")

class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    blacklisted_at = Column(DateTime, default=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    reset_password_token = Column(String, nullable=True)
    reset_password_expires_at = Column(DateTime, nullable=True)
    
    # Profile Fields
    nickname = Column(String, unique=True, index=True, nullable=True)
    gender = Column(String, nullable=True)
    dob = Column(String, nullable=True)  # Store as YYYY-MM-DD
    bio = Column(String, nullable=True)
    position = Column(String, nullable=True)
    pfp_url = Column(String, nullable=True)
    status = Column(String, default="online")
    read_receipts_enabled = Column(Boolean, default=True)
    active_room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="SET NULL"), nullable=True)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    lockout_until = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=func.now())

    active_room = relationship("DataRoom", foreign_keys=[active_room_id])
    organizations = relationship("Organization", secondary="user_organization", back_populates="users")
    teams = relationship("Team", secondary="user_team", back_populates="users")
    workspaces = relationship("Workspace", secondary="user_workspace", back_populates="users")
