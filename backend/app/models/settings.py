from sqlalchemy import Column, Integer, String
from app.database import Base

class Settings(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, primary_key=True, index=True)
    value = Column(String)
