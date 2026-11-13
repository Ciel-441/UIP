from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.models.intelligence import ExtractionRule
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(tags=["extraction-rules"])

class RuleCreate(BaseModel):
    rule_text: str
    domain: str | None = None

@router.get("")
async def get_rules(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ExtractionRule)
        .where(ExtractionRule.room_id == membership.room_id)
        .order_by(ExtractionRule.created_at.desc())
    )
    rules = result.scalars().all()
    return rules

@router.post("")
async def create_rule(
    rule_data: RuleCreate,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db)
):
    new_rule = ExtractionRule(
        room_id=membership.room_id,
        user_id=membership.user.id,
        rule_text=rule_data.rule_text,
        domain=rule_data.domain,
        is_active=True
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)
    return new_rule

@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: int,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ExtractionRule)
        .where(ExtractionRule.id == rule_id)
        .where(ExtractionRule.room_id == membership.room_id)
    )
    rule = result.scalars().first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    await db.delete(rule)
    await db.commit()
    return {"message": "Rule deleted"}
