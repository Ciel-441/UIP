"""Authentication router – register, login, and current user profile."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models import User
from app.schemas.user import UserCreate, UserResponse, TokenResponse, RegisterResponse
from app.services import auth_service
from app.utils.security import get_current_user
from app.utils.rate_limit import limiter

from pydantic import BaseModel

router = APIRouter()

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user and return access token with user info."""
    result = await auth_service.register_user(
        email=user_data.email,
        password=user_data.password,
        name=user_data.name,
        db=db,
    )
    return result


@router.get("/verify")
@limiter.limit("10/minute")
async def verify_email(request: Request, token: str, db: AsyncSession = Depends(get_db)):
    """Verify an email using the token."""
    result = await db.execute(select(User).where(User.verification_token == token))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
        
    user.is_verified = True
    user.verification_token = None
    await db.commit()
    
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user with email (username field) and password, return JWT token."""
    result = await auth_service.authenticate_user(
        email=form_data.username,
        password=form_data.password,
        db=db,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return result


from datetime import datetime, timedelta

# In-memory store for active users: {user_id: {"name": string, "last_seen": datetime}}
active_users = {}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile and update last seen."""
    active_users[current_user.id] = {
        "name": current_user.name,
        "last_seen": datetime.now()
    }
    return current_user

@router.get("/online")
async def get_online_users(current_user: User = Depends(get_current_user)):
    """Return a list of users active in the last 5 minutes."""
    active_users[current_user.id] = {
        "name": current_user.name,
        "last_seen": datetime.now()
    }
    
    cutoff = datetime.now() - timedelta(minutes=5)
    
    online = []
    for uid, data in list(active_users.items()):
        if data["last_seen"] > cutoff:
            online.append({"id": uid, "name": data["name"]})
        else:
            del active_users[uid]
            
    return {"online_users": online}


@router.get("/users")
async def get_all_users(request: Request, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return a list of all users, filtered by room if X-Room-Id is present or falling back to active_room_id."""
    from app.models.multi_tenant import RoomMembership, MembershipStatus
    from sqlalchemy import and_, or_
    
    room_id_str = request.headers.get("X-Room-Id") or request.headers.get("x-room-id")
    print(f"DEBUG: get_all_users X-Room-Id={room_id_str} fallback={current_user.active_room_id}", flush=True)
    
    room_id = None
    if room_id_str:
        try:
            room_id = int(room_id_str)
        except ValueError:
            pass
            
    if not room_id:
        room_id = current_user.active_room_id
        
    if room_id:
        result = await db.execute(
            select(User)
            .outerjoin(RoomMembership, and_(User.id == RoomMembership.user_id, RoomMembership.room_id == room_id))
            .where(
                or_(
                    User.email == 'ai@system.local',
                    and_(RoomMembership.room_id == room_id, RoomMembership.status == MembershipStatus.approved)
                )
            )
        )
    else:
        result = await db.execute(select(User).where(or_(User.is_verified == True, User.email == 'ai@system.local')))
        
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "nickname": u.nickname,
            "pfp_url": u.pfp_url
        } for u in users
    ]

@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Request a password reset email."""
    return await auth_service.generate_password_reset_token(email=body.email, db=db)

@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset the password using a token."""
    return await auth_service.reset_password_with_token(
        token=body.token, 
        new_password=body.new_password, 
        db=db
    )


from app.utils.security import oauth2_scheme
from app.models import TokenBlacklist

@router.post("/logout")
async def logout(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Blacklist the user's active session token."""
    blacklisted = TokenBlacklist(token=token)
    db.add(blacklisted)
    await db.commit()
    return {"message": "Logged out successfully"}
