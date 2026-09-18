"""AI router – query the Ollama-backed assistant and check its status."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas.search import AIQueryRequest, AIQueryResponse, AIStatusResponse
from app.services import ai_service
from app.utils.security import get_current_user
from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership
from app.utils.rate_limit import limiter

router = APIRouter()


@router.post("/query", response_model=AIQueryResponse)
@limiter.limit("10/minute")
async def query_ai(
    request: Request,
    body: AIQueryRequest,
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Send a natural-language question to the AI assistant."""
    result = await ai_service.query_ai(
        question=body.question,
        user_id=membership.user.id,
        room_id=membership.room_id,
        db=db,
        agent_persona=getattr(body, "agent_persona", "Research Assistant")
    )
    return result


@router.get("/status", response_model=AIStatusResponse)
async def ai_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check whether the Ollama backend is reachable."""
    result = await ai_service.check_ollama_status(user_id=current_user.id, db=db)
    return result
