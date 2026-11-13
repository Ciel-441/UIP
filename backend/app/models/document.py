from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    content_text = Column(Text, nullable=True)
    status = Column(String, default="uploaded")
    progress = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id"))
    entity_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    extracted_entities = Column(JSON, nullable=True)
    extracted_relationships = Column(JSON, nullable=True)

    room = relationship("DataRoom")

