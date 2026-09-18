from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any

from app.database import get_db
from app.models.intelligence import Hypothesis
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(tags=["feed"])

@router.get("")
async def get_discovery_feed(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db)
):
    """Returns the real-time discovery feed containing recent hypotheses and discoveries."""
    result = await db.execute(
        select(Hypothesis)
        .where(Hypothesis.room_id == membership.room_id)
        .order_by(Hypothesis.created_at.desc())
        .limit(50)
    )
    hypotheses = result.scalars().all()
    
    feed_items = []
    for h in hypotheses:
        feed_items.append({
            "id": h.id,
            "type": "hypothesis",
            "title": h.title,
            "description": h.description,
            "status": h.status,
            "confidence": h.confidence,
            "timestamp": h.created_at,
            "evidence": h.evidence
        })
        
    return feed_items
