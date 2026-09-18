from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    type = Column(String, nullable=False) # 'team' or 'direct'
    name = Column(String, nullable=True) # Name for team chats
    bio = Column(String, nullable=True) # Description for team chats
    pfp_url = Column(String, nullable=True) # Avatar URL for team chats
    created_at = Column(DateTime, default=func.now())
    
    room = relationship("DataRoom")
    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class ConversationMember(Base):
    __tablename__ = "conversation_members"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member") # 'admin' or 'member'
    is_server_muted = Column(Boolean, default=False) # Admin muted them from sending messages
    is_local_muted = Column(Boolean, default=False) # User muted this chat's notifications locally
    is_pinned = Column(Boolean, default=False) # User pinned this chat
    is_hidden = Column(Boolean, default=False) # User hid this chat from the list
    last_read_message_id = Column(Integer, default=0) # Tracks the last read message for unread counts
    cleared_until_message_id = Column(Integer, default=0) # Tracks deleted chat history
    joined_at = Column(DateTime, default=func.now())
    
    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User", backref="conversations")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    has_attachments = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    timestamp = Column(DateTime, default=func.now())
    
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", backref="messages_sent")
    attachments = relationship("MessageAttachment", back_populates="message", cascade="all, delete-orphan")
    reply_to = relationship("Message", remote_side=[id], backref="replies")

class MessageAttachment(Base):
    __tablename__ = "message_attachments"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    file_url = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    
    message = relationship("Message", back_populates="attachments")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    link_url = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=func.now())
    
    user = relationship("User", backref="notifications")
