from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select, or_, and_
import os
import uuid
import shutil

from app.database import get_db
from app.models.user import User, BlockedUser
from app.routers.auth import get_current_user
from app.schemas.user import UserResponse
from app.config import settings
from app.routers.communication import manager
from sqlalchemy.orm import selectinload
from app.utils.rbac import get_room_membership
from app.models.multi_tenant import RoomMembership, MembershipStatus

router = APIRouter(tags=["profile"])

class ProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    bio: Optional[str] = None
    position: Optional[str] = None
    pfp_url: Optional[str] = None
    status: Optional[str] = None
    read_receipts_enabled: Optional[bool] = None

class ProfileResponse(UserResponse):
    nickname: Optional[str]
    gender: Optional[str]
    dob: Optional[str]
    bio: Optional[str]
    position: Optional[str]
    pfp_url: Optional[str]
    status: Optional[str] = None
    read_receipts_enabled: Optional[bool] = None
    is_blocked_by_me: Optional[bool] = False
    room_role: Optional[str] = None

@router.get("/all")
async def get_all_users(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db)
):
    """Get all users who are approved members of the active Data Room."""
    result = await db.execute(
        select(User)
        .outerjoin(RoomMembership, RoomMembership.user_id == User.id)
        .where(
            or_(
                and_(
                    RoomMembership.room_id == membership.room_id,
                    RoomMembership.status == MembershipStatus.approved
                ),
                User.email == 'ai@system.local'
            )
        )
        .distinct()
    )
    users = result.scalars().all()
    
    return [
        {
            "id": u.id,
            "name": u.name,
            "nickname": u.nickname,
            "pfp_url": u.pfp_url,
            "status": "online" if u.id in manager.active_connections or u.email == 'ai@system.local' else getattr(u, 'status', 'offline'),
            "email": u.email
        }
        for u in users if u.id != membership.user_id
    ]

@router.get("", response_model=ProfileResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get the current user's full profile."""
    return current_user

@router.get("/{user_id}", response_model=ProfileResponse)
async def get_other_profile(user_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get another user's public profile details."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    block_check = await db.execute(select(BlockedUser).where(
        (BlockedUser.blocker_id == current_user.id) & (BlockedUser.blocked_id == user_id)
    ))
    is_blocked_by_me = block_check.scalars().first() is not None
        
    from app.routers.communication import manager
    from app.models.multi_tenant import RoomMembership
    
    room_role = None
    if current_user.active_room_id:
        room_mem_result = await db.execute(
            select(RoomMembership).where(
                (RoomMembership.user_id == user_id) & 
                (RoomMembership.room_id == current_user.active_room_id)
            )
        )
        room_membership = room_mem_result.scalars().first()
        if room_membership:
            room_role = room_membership.role.value
        
    user_dict = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "created_at": user.created_at,
        "nickname": user.nickname,
        "pfp_url": user.pfp_url,
        "gender": user.gender,
        "dob": user.dob,
        "bio": user.bio,
        "position": user.position,
        "status": getattr(user, 'status', 'online') if (user.id in manager.active_connections or getattr(user, 'email', '') == 'ai@system.local') else 'offline',
        "read_receipts_enabled": user.read_receipts_enabled,
        "is_blocked_by_me": is_blocked_by_me,
        "room_role": room_role
    }
    return user_dict

@router.put("", response_model=ProfileResponse)
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update the current user's profile."""
    if profile_data.nickname is not None:
        if profile_data.nickname != current_user.nickname:
            existing_user = await db.execute(select(User).where(User.nickname == profile_data.nickname))
            if existing_user.scalars().first():
                raise HTTPException(status_code=400, detail="Username already taken")
        current_user.nickname = profile_data.nickname
    if profile_data.gender is not None:
        current_user.gender = profile_data.gender
    if profile_data.dob is not None:
        current_user.dob = profile_data.dob
    if profile_data.bio is not None:
        current_user.bio = profile_data.bio
    if profile_data.position is not None:
        current_user.position = profile_data.position
    if profile_data.pfp_url is not None:
        current_user.pfp_url = profile_data.pfp_url
    if profile_data.status is not None:
        current_user.status = profile_data.status
    if profile_data.read_receipts_enabled is not None:
        current_user.read_receipts_enabled = profile_data.read_receipts_enabled

    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.post("/upload-pfp")
async def upload_pfp(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a profile picture and update the user's pfp_url."""
    from app.utils.file_validation import validate_file_upload
    
    # Strictly define allowed image types for Pfps
    ALLOWED_PFP_EXTENSIONS = {
        ".png": ["image/png"],
        ".jpg": ["image/jpeg", "image/jpg"],
        ".jpeg": ["image/jpeg", "image/jpg"],
        ".gif": ["image/gif"],
        ".webp": ["image/webp"]
    }
    
    # Validate the image extension, MIME type, and magic bytes signature
    ext = await validate_file_upload(file, ALLOWED_PFP_EXTENSIONS)

    # Create an uploads/pfp directory inside the main upload directory
    pfp_dir = os.path.join(settings.UPLOAD_DIR, "pfp")
    os.makedirs(pfp_dir, exist_ok=True)

    # Generate a unique filename
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(pfp_dir, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    pfp_url = f"/api/profile/pfp/{filename}"
    current_user.pfp_url = pfp_url
    await db.commit()
    return {"pfp_url": pfp_url}

from fastapi.responses import FileResponse
@router.get("/pfp/{filename}")
async def get_pfp(filename: str):
    """Serve the profile picture."""
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(settings.UPLOAD_DIR, "pfp", safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)

@router.post("/block/{user_id}")
async def block_user(user_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    existing = await db.execute(select(BlockedUser).where(
        (BlockedUser.blocker_id == current_user.id) & 
        (BlockedUser.blocked_id == user_id)
    ))
    if existing.scalars().first():
        return {"status": "already blocked"}
        
    blocked = BlockedUser(blocker_id=current_user.id, blocked_id=user_id)
    db.add(blocked)
    await db.commit()
    return {"status": "blocked"}

@router.delete("/block/{user_id}")
async def unblock_user(user_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(BlockedUser).where(
        (BlockedUser.blocker_id == current_user.id) & 
        (BlockedUser.blocked_id == user_id)
    ))
    blocked = existing.scalars().first()
    if blocked:
        await db.delete(blocked)
        await db.commit()
    return {"status": "unblocked"}
