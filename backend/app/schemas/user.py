from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")
    name: str = Field(..., min_length=2, max_length=50)


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    created_at: Optional[datetime] = None
    nickname: Optional[str] = None
    pfp_url: Optional[str] = None
    status: Optional[str] = "online"

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    message: str
    user: UserResponse
