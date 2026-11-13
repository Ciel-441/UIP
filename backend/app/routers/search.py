"""Search router – unified search across entities, relationships, and documents."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas.search import SearchResponse
from app.services import search_service
from app.utils.security import get_current_user
from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership

router = APIRouter()


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1),
    type: str = Query("all"),
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Search across entities, relationships, and documents."""
    results = await search_service.search_all(query=q, type_filter=type, db=db, room_id=membership.room_id)
    return {"results": results}
