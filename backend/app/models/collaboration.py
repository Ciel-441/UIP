from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

# Association table for User-Organization Many-to-Many
user_organization = Table(
    "user_organization",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("organization_id", Integer, ForeignKey("organizations.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), nullable=True),
)

# Association table for User-Team Many-to-Many
user_team = Table(
    "user_team",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("team_id", Integer, ForeignKey("teams.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), nullable=True),
)

# Association table for User-Workspace Many-to-Many
user_workspace = Table(
    "user_workspace",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("workspace_id", Integer, ForeignKey("workspaces.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), nullable=True),
)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    users = relationship("User", secondary=user_organization, back_populates="organizations")
    teams = relationship("Team", back_populates="organization")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

    organization = relationship("Organization", back_populates="teams")
    users = relationship("User", secondary=user_team, back_populates="teams")
    workspaces = relationship("Workspace", back_populates="team")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

    team = relationship("Team", back_populates="workspaces")
    users = relationship("User", secondary=user_workspace, back_populates="workspaces")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)  # Admin, Editor, Viewer
    permissions = Column(Text, nullable=True)  # JSON or comma-separated
    created_at = Column(DateTime, default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)  # e.g., "MERGE_ENTITY", "DELETE_DOCUMENT"
    resource_type = Column(String, nullable=False)  # e.g., "Entity", "Document"
    resource_id = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)  # JSON
    new_value = Column(Text, nullable=True)  # JSON
    timestamp = Column(DateTime, default=func.now())

    room = relationship("DataRoom")
    user = relationship("User", backref="audit_logs")
