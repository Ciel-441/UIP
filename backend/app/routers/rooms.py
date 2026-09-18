"""Data Room management router – create, join, manage rooms and members."""

import secrets
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.multi_tenant import (
    DataRoom, RoomMembership, InviteCode, RoomGroup, RoomGroupMember,
    RoomRole, MembershipStatus,
)
from app.utils.security import get_current_user
from app.utils.rbac import require_room_admin, get_room_membership

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class CreateRoomResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    role: str
    created_at: str


class RoomListItem(BaseModel):
    id: int
    name: str
    description: Optional[str]
    role: str
    member_count: int
    created_at: str


class JoinRoomRequest(BaseModel):
    invite_code: str


class GenerateInviteRequest(BaseModel):
    max_uses: int = Field(default=10, ge=1, le=100)
    expires_hours: int = Field(default=168, ge=1, le=720)  # Default 7 days, max 30 days


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(admin|editor|analyst|viewer)$")


class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class AddGroupMembersRequest(BaseModel):
    user_ids: List[int]


class AddRoomMemberRequest(BaseModel):
    user_id: int
    role: str = Field("viewer", pattern="^(admin|editor|analyst|viewer)$")


class MemberResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    role: str
    status: str
    joined_at: Optional[str]


class PendingRequestResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    created_at: str


# ── Room CRUD ────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_room(
    body: CreateRoomRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new Data Room. The creator becomes the Master Admin."""
    # Check room creation limit
    room_count_result = await db.execute(
        select(func.count(DataRoom.id)).where(DataRoom.created_by == current_user.id)
    )
    room_count = room_count_result.scalar()

    if room_count >= settings.MAX_DATA_ROOMS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You have reached the maximum of {settings.MAX_DATA_ROOMS_PER_USER} Data Rooms.",
        )

    # Create the room
    room = DataRoom(
        name=body.name,
        description=body.description,
        created_by=current_user.id,
    )
    db.add(room)
    await db.flush()
    await db.refresh(room)

    # Create admin membership for the creator
    membership = RoomMembership(
        user_id=current_user.id,
        room_id=room.id,
        role=RoomRole.admin,
        status=MembershipStatus.approved,
        joined_at=datetime.utcnow(),
    )
    db.add(membership)
    await db.flush()

    # Set this as the user's active room
    current_user.active_room_id = room.id
    await db.flush()

    return {
        "id": room.id,
        "name": room.name,
        "description": room.description,
        "role": "admin",
        "created_at": room.created_at.isoformat() if room.created_at else "",
    }


@router.get("")
async def list_my_rooms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all Data Rooms the user is a member of (approved only)."""
    result = await db.execute(
        select(RoomMembership)
        .options(selectinload(RoomMembership.room))
        .where(
            RoomMembership.user_id == current_user.id,
            RoomMembership.status == MembershipStatus.approved,
        )
    )
    memberships = result.scalars().all()

    rooms = []
    for m in memberships:
        # Count members
        count_result = await db.execute(
            select(func.count(RoomMembership.id)).where(
                RoomMembership.room_id == m.room_id,
                RoomMembership.status == MembershipStatus.approved,
            )
        )
        member_count = count_result.scalar()

        rooms.append({
            "id": m.room.id,
            "name": m.room.name,
            "description": m.room.description,
            "role": m.role.value,
            "member_count": member_count,
            "created_at": m.room.created_at.isoformat() if m.room.created_at else "",
        })

    return {"rooms": rooms, "active_room_id": current_user.active_room_id}


@router.get("/pending")
async def list_pending_rooms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List rooms where the user has a pending join request."""
    result = await db.execute(
        select(RoomMembership)
        .options(selectinload(RoomMembership.room))
        .where(
            RoomMembership.user_id == current_user.id,
            RoomMembership.status == MembershipStatus.pending,
        )
    )
    memberships = result.scalars().all()

    return {
        "pending": [
            {
                "id": m.id,
                "room_id": m.room.id,
                "room_name": m.room.name,
                "created_at": m.created_at.isoformat() if m.created_at else "",
            }
            for m in memberships
        ]
    }


@router.put("/active/{room_id}")
async def set_active_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set the user's currently active Data Room."""
    # Verify membership
    result = await db.execute(
        select(RoomMembership).where(
            RoomMembership.user_id == current_user.id,
            RoomMembership.room_id == room_id,
            RoomMembership.status == MembershipStatus.approved,
        )
    )
    membership = result.scalars().first()
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this room.")

    current_user.active_room_id = room_id
    await db.flush()

    return {"success": True, "active_room_id": room_id}


# ── Join Flow ────────────────────────────────────────────────

@router.post("/join")
async def join_room(
    body: JoinRoomRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a join request using an invite code. User enters pending state."""
    # Find the invite code
    result = await db.execute(
        select(InviteCode).where(InviteCode.code == body.invite_code)
    )
    invite = result.scalars().first()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite code.")

    if not invite.is_valid:
        raise HTTPException(status_code=400, detail="This invite code has expired or been fully used.")

    # Check if user already has a membership in this room
    existing = await db.execute(
        select(RoomMembership).where(
            RoomMembership.user_id == current_user.id,
            RoomMembership.room_id == invite.room_id,
        )
    )
    existing_membership = existing.scalars().first()

    if existing_membership:
        if existing_membership.status == MembershipStatus.approved:
            raise HTTPException(status_code=400, detail="You are already a member of this room.")
        elif existing_membership.status == MembershipStatus.pending:
            raise HTTPException(status_code=400, detail="Your join request is already pending approval.")
        elif existing_membership.status == MembershipStatus.banned:
            raise HTTPException(status_code=403, detail="You have been banned from this room.")
        elif existing_membership.status == MembershipStatus.rejected:
            # Allow re-request
            existing_membership.status = MembershipStatus.pending
            existing_membership.created_at = datetime.utcnow()
            await db.flush()
            invite.uses += 1
            await db.flush()
            
            from app.routers.communication import manager
            import json
            admins_query = await db.execute(
                select(RoomMembership.user_id).where(
                    RoomMembership.room_id == invite.room_id,
                    RoomMembership.role == RoomRole.admin,
                    RoomMembership.status == MembershipStatus.approved
                )
            )
            admin_ids = admins_query.scalars().all()
            room_query = await db.execute(select(DataRoom).where(DataRoom.id == invite.room_id))
            room_obj = room_query.scalars().first()
            room_name = room_obj.name if room_obj else "a room"

            msg = json.dumps({
                "type": "room_join_request",
                "user_name": current_user.name,
                "room_name": room_name
            })
            for a_id in admin_ids:
                await manager.send_personal_message(msg, a_id)

            return {"status": "pending", "message": "Your join request has been re-submitted for approval."}

    # Create pending membership
    membership = RoomMembership(
        user_id=current_user.id,
        room_id=invite.room_id,
        role=RoomRole.viewer,
        status=MembershipStatus.pending,
    )
    db.add(membership)

    # Increment invite usage
    invite.uses += 1
    await db.flush()

    from app.routers.communication import manager
    import json
    admins_query = await db.execute(
        select(RoomMembership.user_id).where(
            RoomMembership.room_id == invite.room_id,
            RoomMembership.role == RoomRole.admin,
            RoomMembership.status == MembershipStatus.approved
        )
    )
    admin_ids = admins_query.scalars().all()
    room_query = await db.execute(select(DataRoom).where(DataRoom.id == invite.room_id))
    room_obj = room_query.scalars().first()
    room_name = room_obj.name if room_obj else "a room"

    msg = json.dumps({
        "type": "room_join_request",
        "user_name": current_user.name,
        "room_name": room_name
    })
    for a_id in admin_ids:
        await manager.send_personal_message(msg, a_id)

    return {"status": "pending", "message": "Your join request has been submitted. Waiting for admin approval."}


# ── Admin: Invite Codes ──────────────────────────────────────

@router.post("/invites")
async def generate_invite_code(
    body: GenerateInviteRequest,
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new invite code for the room (admin only)."""
    invite = InviteCode(
        code=secrets.token_urlsafe(24),
        room_id=membership.room_id,
        created_by=membership.user_id,
        max_uses=body.max_uses,
        expires_at=datetime.utcnow() + timedelta(hours=body.expires_hours),
    )
    db.add(invite)
    await db.flush()
    await db.refresh(invite)

    return {
        "code": invite.code,
        "max_uses": invite.max_uses,
        "expires_at": invite.expires_at.isoformat(),
    }


@router.get("/invites")
async def list_invite_codes(
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all invite codes for the room (admin only)."""
    result = await db.execute(
        select(InviteCode).where(
            InviteCode.room_id == membership.room_id,
            InviteCode.is_revoked == False,
        ).order_by(InviteCode.created_at.desc())
    )
    invites = result.scalars().all()

    return {
        "invites": [
            {
                "id": inv.id,
                "code": inv.code,
                "max_uses": inv.max_uses,
                "uses": inv.uses,
                "expires_at": inv.expires_at.isoformat() if inv.expires_at else "",
                "is_valid": inv.is_valid,
                "created_at": inv.created_at.isoformat() if inv.created_at else "",
            }
            for inv in invites
        ]
    }


@router.delete("/invites/{invite_id}")
async def revoke_invite_code(
    invite_id: int,
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an invite code (admin only)."""
    result = await db.execute(
        select(InviteCode).where(
            InviteCode.id == invite_id,
            InviteCode.room_id == membership.room_id,
        )
    )
    invite = result.scalars().first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite code not found.")

    invite.is_revoked = True
    await db.flush()

    return {"success": True}


# ── Admin: Approve/Deny Requests ─────────────────────────────

@router.get("/requests")
async def list_pending_requests(
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """List pending join requests, banned, and rejected members for the room (admin only)."""
    result = await db.execute(
        select(RoomMembership)
        .options(selectinload(RoomMembership.user))
        .where(
            RoomMembership.room_id == membership.room_id,
            RoomMembership.status.in_([MembershipStatus.pending, MembershipStatus.banned, MembershipStatus.rejected]),
        )
        .order_by(RoomMembership.created_at.desc())
    )
    pending = result.scalars().all()

    return {
        "requests": [
            {
                "id": p.id,
                "user_id": p.user_id,
                "user_name": p.user.name if p.user else "Unknown",
                "user_email": p.user.email if p.user else "",
                "status": p.status.value,
                "created_at": p.created_at.isoformat() if p.created_at else "",
            }
            for p in pending
        ]
    }


@router.post("/requests/{membership_id}/approve")
async def approve_request(
    membership_id: int,
    admin_membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending join request (admin only)."""
    result = await db.execute(
        select(RoomMembership).where(
            RoomMembership.id == membership_id,
            RoomMembership.room_id == admin_membership.room_id,
            RoomMembership.status == MembershipStatus.pending,
        )
    )
    target = result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Pending request not found.")

    target.status = MembershipStatus.approved
    target.joined_at = datetime.utcnow()
    await db.flush()
    
    from app.routers.communication import manager
    import json
    room_query = await db.execute(select(DataRoom).where(DataRoom.id == target.room_id))
    room_obj = room_query.scalars().first()
    room_name = room_obj.name if room_obj else "a room"

    msg = json.dumps({
        "type": "room_approved",
        "room_name": room_name,
        "room_id": target.room_id
    })
    await manager.send_personal_message(msg, target.user_id)

    return {"success": True, "message": "User approved as Viewer."}


@router.post("/requests/{membership_id}/reject")
async def reject_request(
    membership_id: int,
    admin_membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending join request (admin only)."""
    result = await db.execute(
        select(RoomMembership).where(
            RoomMembership.id == membership_id,
            RoomMembership.room_id == admin_membership.room_id,
            RoomMembership.status == MembershipStatus.pending,
        )
    )
    target = result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Pending request not found.")

    target.status = MembershipStatus.rejected
    await db.flush()

    return {"success": True, "message": "Request rejected."}


# ── Admin: Member Management ─────────────────────────────────

@router.get("/members")
async def list_members(
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all approved members of the room (admin only)."""
    result = await db.execute(
        select(RoomMembership)
        .options(selectinload(RoomMembership.user))
        .where(
            RoomMembership.room_id == membership.room_id,
            RoomMembership.status == MembershipStatus.approved,
        )
        .order_by(RoomMembership.role, RoomMembership.joined_at)
    )
    members = result.scalars().all()
    # Fetch the room to find the creator
    room_result = await db.execute(
        select(DataRoom).where(DataRoom.id == membership.room_id)
    )
    room = room_result.scalars().first()
    creator_id = room.created_by if room else None

    return {
        "members": [
            {
                "id": m.id,
                "user_id": m.user_id,
                "user_name": m.user.name if m.user else "Unknown",
                "user_email": m.user.email if m.user else "",
                "role": m.role.value,
                "status": m.status.value,
                "joined_at": m.joined_at.isoformat() if m.joined_at else "",
                "pfp_url": m.user.pfp_url if m.user else None,
                "is_creator": m.user_id == creator_id,
            }
            for m in members
        ]
    }


@router.put("/members/{membership_id}/role")
async def update_member_role(
    membership_id: int,
    body: UpdateMemberRoleRequest,
    admin_membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a member's role (admin only). Room creator is absolute admin."""
    result = await db.execute(
        select(RoomMembership).where(
            RoomMembership.id == membership_id,
            RoomMembership.room_id == admin_membership.room_id,
            RoomMembership.status == MembershipStatus.approved,
        )
    )
    target = result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found.")

    # Fetch room to find the creator
    room_result = await db.execute(
        select(DataRoom).where(DataRoom.id == admin_membership.room_id)
    )
    room = room_result.scalars().first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    
    creator_id = room.created_by
    requester_id = admin_membership.user_id
    target_id = target.user_id

    # 1. No other admin can demote the creator
    if target_id == creator_id and requester_id != creator_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The room creator is the absolute admin and cannot be demoted by others."
        )

    # 2. Only the user themselves or the room creator can demote an admin
    if target.role == RoomRole.admin and requester_id != target_id and requester_id != creator_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the user themselves or the room creator can demote another admin."
        )

    target.role = RoomRole(body.role)
    await db.flush()

    return {"success": True, "new_role": body.role}


@router.delete("/members/{membership_id}")
async def kick_member(
    membership_id: int,
    admin_membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the room (admin only). Room creator can remove anyone."""
    result = await db.execute(
        select(RoomMembership)
        .options(selectinload(RoomMembership.user))
        .where(
            RoomMembership.id == membership_id,
            RoomMembership.room_id == admin_membership.room_id,
        )
    )
    target = result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found.")

    # Fetch room to find the creator
    room_result = await db.execute(
        select(DataRoom).where(DataRoom.id == admin_membership.room_id)
    )
    room = room_result.scalars().first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    
    creator_id = room.created_by
    requester_id = admin_membership.user_id
    target_id = target.user_id

    # 1. No other admin can remove the creator
    if target_id == creator_id and requester_id != creator_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The room creator is the absolute admin and cannot be removed by others."
        )

    # 2. Only the user themselves or the room creator can remove an admin
    if target.role == RoomRole.admin and requester_id != target_id and requester_id != creator_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the user themselves or the room creator can remove another admin."
        )

    target.status = MembershipStatus.banned
    
    # If the kicked user has this room set as their active room, clear it
    if target.user and target.user.active_room_id == admin_membership.room_id:
        target.user.active_room_id = None
        
    await db.flush()

    # Send WebSocket notification to the kicked user
    from app.routers.communication import manager
    import json
    msg = json.dumps({
        "type": "room_kicked",
        "room_id": admin_membership.room_id,
        "room_name": room.name
    })
    await manager.send_personal_message(msg, target_id)

    return {"success": True, "message": "Member removed from room."}


@router.post("/members", status_code=status.HTTP_201_CREATED)
async def add_room_member(
    body: AddRoomMemberRequest,
    admin_membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a verified user to the room directly (admin only)."""
    # 1. Fetch user to add
    res_user = await db.execute(select(User).where(User.id == body.user_id))
    user = res_user.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {body.user_id} not found."
        )

    # 2. Check if already has membership
    res_mem = await db.execute(
        select(RoomMembership)
        .where(
            RoomMembership.room_id == admin_membership.room_id,
            RoomMembership.user_id == body.user_id
        )
    )
    membership = res_mem.scalar_one_or_none()

    if membership:
        if membership.status == MembershipStatus.approved:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User '{user.name}' is already an approved member of this room."
            )
        # Reactivate/approve pending, rejected, or banned
        membership.status = MembershipStatus.approved
        membership.role = RoomRole(body.role)
        membership.joined_at = datetime.utcnow()
    else:
        # Create new membership
        membership = RoomMembership(
            user_id=body.user_id,
            room_id=admin_membership.room_id,
            role=RoomRole(body.role),
            status=MembershipStatus.approved,
            joined_at=datetime.utcnow()
        )
        db.add(membership)

    await db.flush()
    return {
        "success": True,
        "membership_id": membership.id,
        "message": f"Successfully added '{user.name}' to the room."
    }


# ── Admin: Groups ─────────────────────────────────────────────

@router.get("/groups")
async def list_groups(
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all groups in the room (admin only)."""
    result = await db.execute(
        select(RoomGroup)
        .options(selectinload(RoomGroup.members))
        .where(RoomGroup.room_id == membership.room_id)
        .order_by(RoomGroup.name)
    )
    groups = result.scalars().all()

    return {
        "groups": [
            {
                "id": g.id,
                "name": g.name,
                "description": g.description,
                "member_count": len(g.members),
                "created_at": g.created_at.isoformat() if g.created_at else "",
            }
            for g in groups
        ]
    }


@router.post("/groups")
async def create_group(
    body: CreateGroupRequest,
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new group within the room (admin only)."""
    group = RoomGroup(
        room_id=membership.room_id,
        name=body.name,
        description=body.description,
    )
    db.add(group)
    await db.flush()
    await db.refresh(group)

    return {"id": group.id, "name": group.name}


@router.post("/groups/{group_id}/members")
async def add_group_members(
    group_id: int,
    body: AddGroupMembersRequest,
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add members to a group (admin only)."""
    # Verify group belongs to this room
    group_result = await db.execute(
        select(RoomGroup).where(
            RoomGroup.id == group_id,
            RoomGroup.room_id == membership.room_id,
        )
    )
    group = group_result.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")

    added = 0
    for user_id in body.user_ids:
        # Verify user is an approved member of the room
        member_check = await db.execute(
            select(RoomMembership).where(
                RoomMembership.user_id == user_id,
                RoomMembership.room_id == membership.room_id,
                RoomMembership.status == MembershipStatus.approved,
            )
        )
        if not member_check.scalars().first():
            continue

        # Check if already in group
        existing = await db.execute(
            select(RoomGroupMember).where(
                RoomGroupMember.group_id == group_id,
                RoomGroupMember.user_id == user_id,
            )
        )
        if existing.scalars().first():
            continue

        gm = RoomGroupMember(group_id=group_id, user_id=user_id)
        db.add(gm)
        added += 1

    await db.flush()

    return {"success": True, "added": added}


@router.delete("/groups/{group_id}/members/{user_id}")
async def remove_group_member(
    group_id: int,
    user_id: int,
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from a group (admin only)."""
    result = await db.execute(
        select(RoomGroupMember).where(
            RoomGroupMember.group_id == group_id,
            RoomGroupMember.user_id == user_id,
        )
    )
    gm = result.scalars().first()
    if not gm:
        raise HTTPException(status_code=404, detail="Member not found in group.")

    await db.delete(gm)
    await db.flush()

    return {"success": True}


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: int,
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a group (admin only)."""
    result = await db.execute(
        select(RoomGroup).where(
            RoomGroup.id == group_id,
            RoomGroup.room_id == membership.room_id,
        )
    )
    group = result.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")

    await db.delete(group)
    await db.flush()

    return {"success": True}


# ── Room Info (for any approved member) ───────────────────────

@router.get("/info")
async def get_room_info(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Get current room details and the user's role within it."""
    room_result = await db.execute(
        select(DataRoom).where(DataRoom.id == membership.room_id)
    )
    room = room_result.scalars().first()

    # Count members
    count_result = await db.execute(
        select(func.count(RoomMembership.id)).where(
            RoomMembership.room_id == membership.room_id,
            RoomMembership.status == MembershipStatus.approved,
        )
    )
    member_count = count_result.scalar()

    # Count pending requests (only show to admin)
    pending_count = 0
    if membership.role == RoomRole.admin:
        pending_result = await db.execute(
            select(func.count(RoomMembership.id)).where(
                RoomMembership.room_id == membership.room_id,
                RoomMembership.status == MembershipStatus.pending,
            )
        )
        pending_count = pending_result.scalar()

    return {
        "id": room.id,
        "name": room.name,
        "description": room.description,
        "role": membership.role.value,
        "member_count": member_count,
        "pending_count": pending_count,
        "created_at": room.created_at.isoformat() if room.created_at else "",
        "created_by": room.created_by,
    }


@router.delete("/{room_id}")
async def delete_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a room (admin/creator only)."""
    # 1. Verify that user is an admin or creator in this room
    membership_res = await db.execute(
        select(RoomMembership).where(
            RoomMembership.room_id == room_id,
            RoomMembership.user_id == current_user.id,
            RoomMembership.role == RoomRole.admin,
            RoomMembership.status == MembershipStatus.approved,
        )
    )
    membership = membership_res.scalars().first()
    
    room_res = await db.execute(select(DataRoom).where(DataRoom.id == room_id))
    room = room_res.scalars().first()
    
    if not room:
        raise HTTPException(status_code=404, detail="Data Room not found.")
        
    if not membership and room.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only room admins or the creator can delete this room.")

    # 2. Clear active room for any users who have this room set as active
    users_with_active = await db.execute(select(User).where(User.active_room_id == room_id))
    for user in users_with_active.scalars().all():
        user.active_room_id = None

    # Pre-delete communications records to prevent ForeignKeyViolationError
    from app.models.communication import Conversation, ConversationMember, Message
    from sqlalchemy import delete, update
    
    conv_res = await db.execute(select(Conversation.id).where(Conversation.room_id == room_id))
    conv_ids = [c for c in conv_res.scalars().all()]
    
    if conv_ids:
        # Clear reply_to_id references to prevent self-referential FK issues
        await db.execute(
            update(Message)
            .where(Message.conversation_id.in_(conv_ids))
            .values(reply_to_id=None)
        )
        await db.execute(delete(Message).where(Message.conversation_id.in_(conv_ids)))
        await db.execute(delete(ConversationMember).where(ConversationMember.conversation_id.in_(conv_ids)))
        await db.execute(delete(Conversation).where(Conversation.id.in_(conv_ids)))

    # 3. Delete from Neo4j
    try:
        from app.neo4j_driver import get_neo4j_driver
        driver = get_neo4j_driver()
        with driver.session() as session:
            session.run("MATCH (n) WHERE n.room_id = $room_id DETACH DELETE n", room_id=room_id)
    except Exception as e:
        print(f"Failed to delete Neo4j nodes for room {room_id}: {e}")

    # 4. Delete the DataRoom (DB cascades memberships, files/documents, chat messages, etc.)
    await db.delete(room)
    await db.commit()
    return {"success": True, "message": "Data Room deleted successfully."}


@router.post("/{room_id}/leave")
async def leave_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave a room (with ownership transfer and admin checks)."""
    membership_res = await db.execute(
        select(RoomMembership).where(
            RoomMembership.room_id == room_id,
            RoomMembership.user_id == current_user.id,
            RoomMembership.status == MembershipStatus.approved,
        )
    )
    membership = membership_res.scalars().first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="You are not a member of this room.")
        
    room_res = await db.execute(select(DataRoom).where(DataRoom.id == room_id))
    room = room_res.scalars().first()
    if not room:
        raise HTTPException(status_code=404, detail="Data Room not found.")

    # Rule: If leaving user is the creator or has admin role, we must ensure there is another admin
    if room.created_by == current_user.id or membership.role == RoomRole.admin:
        other_admins_res = await db.execute(
            select(func.count(RoomMembership.id)).where(
                RoomMembership.room_id == room_id,
                RoomMembership.role == RoomRole.admin,
                RoomMembership.status == MembershipStatus.approved,
                RoomMembership.user_id != current_user.id
            )
        )
        other_admins_count = other_admins_res.scalar()
        if other_admins_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are the creator or only admin in this workspace. You cannot leave without assigning another member as admin first."
            )

        # If leaving user is the creator, transfer ownership to one of the other admins
        if room.created_by == current_user.id:
            target_admin_res = await db.execute(
                select(RoomMembership).where(
                    RoomMembership.room_id == room_id,
                    RoomMembership.role == RoomRole.admin,
                    RoomMembership.status == MembershipStatus.approved,
                    RoomMembership.user_id != current_user.id
                ).limit(1)
            )
            target_admin = target_admin_res.scalars().first()
            if target_admin:
                room.created_by = target_admin.user_id

    # If this was the user's active room, clear it
    if current_user.active_room_id == room_id:
        current_user.active_room_id = None
        
    await db.delete(membership)
    await db.commit()
    return {"success": True, "message": "You have successfully left the Data Room."}
