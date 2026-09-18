"""Role-Based Access Control (RBAC) – FastAPI dependencies for room-scoped authorization.

Security Rules:
1. All room-scoped resources require: authenticated user + valid room_id + approved membership + valid role.
2. No room context = No access. No membership = No access. No exceptions.
3. Permissions are enforced SERVER-SIDE only. Frontend checks are UI convenience only.
4. room_id must be explicitly passed from the authenticated request context.
"""

from typing import List, Optional

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.multi_tenant import RoomMembership, RoomRole, MembershipStatus, DataRoom
from app.utils.security import get_current_user


class RequireRole:
    """FastAPI dependency that enforces role-based access for a specific Data Room.
    
    Usage in routers:
        @router.get("/something")
        async def endpoint(
            membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
        ):
            room_id = membership.room_id  # Explicitly available
    """

    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = [RoomRole(r) for r in allowed_roles]

    async def __call__(
        self,
        x_room_id: int = Header(..., alias="X-Room-Id", description="The Data Room ID to operate within"),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> RoomMembership:
        """Validate that the current user has an approved membership with a permitted role in the specified room."""
        
        # 1. Validate room exists and is active
        room_result = await db.execute(
            select(DataRoom).where(DataRoom.id == x_room_id, DataRoom.is_active == True)
        )
        room = room_result.scalars().first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Data Room not found or inactive.",
            )

        # 2. Validate user has an approved membership in this room
        membership_result = await db.execute(
            select(RoomMembership).where(
                RoomMembership.user_id == current_user.id,
                RoomMembership.room_id == x_room_id,
                RoomMembership.status == MembershipStatus.approved,
            )
        )
        membership = membership_result.scalars().first()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this Data Room.",
            )

        # 3. Validate user's role is in the allowed list
        if membership.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(r.value for r in self.allowed_roles)}. Your role: {membership.role.value}.",
            )

        return membership


async def get_room_membership(
    x_room_id: int = Header(..., alias="X-Room-Id", description="The Data Room ID to operate within"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoomMembership:
    """FastAPI dependency that returns the user's approved membership in the room.
    
    This is used when you need room context but don't want to restrict by specific roles.
    Still enforces: authenticated user + valid room_id + approved membership.
    """
    room_result = await db.execute(
        select(DataRoom).where(DataRoom.id == x_room_id, DataRoom.is_active == True)
    )
    room = room_result.scalars().first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data Room not found or inactive.",
        )

    membership_result = await db.execute(
        select(RoomMembership).where(
            RoomMembership.user_id == current_user.id,
            RoomMembership.room_id == x_room_id,
            RoomMembership.status == MembershipStatus.approved,
        )
    )
    membership = membership_result.scalars().first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this Data Room.",
        )

    return membership


async def require_room_admin(
    x_room_id: int = Header(..., alias="X-Room-Id", description="The Data Room ID to operate within"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoomMembership:
    """Convenience dependency: require the user to be an Admin of the specified room."""
    checker = RequireRole(["admin"])
    return await checker(x_room_id=x_room_id, current_user=current_user, db=db)
