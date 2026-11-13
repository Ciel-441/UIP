from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from datetime import datetime
import asyncio
import logging

from app.database import get_db, async_session_maker
from app.models.intelligence import Investigation, Hypothesis
from app.models.user import User
from app.routers.auth import get_current_user
from app.routers.communication import manager
from app.core.pipeline import StandardizedReasoningPipeline

logger = logging.getLogger(__name__)
router = APIRouter(tags=["investigations"])

async def run_autonomous_investigation(investigation_id: int, goal: str, user_id: int, room_id: int):
    """Background task that runs the multi-agent orchestration for an investigation"""
    # Small delay to ensure the HTTP request completes first
    await asyncio.sleep(1)
    
    async with async_session_maker() as db:
        # Load investigation
        result = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
        inv = result.scalars().first()
        if not inv: return

        try:
            # Broadcast start
            await manager.broadcast_global({
                "type": "investigation_update",
                "investigation_id": investigation_id,
                "status": "active",
                "message": f"Agents exploring graph for: {goal}"
            })
            
            # Run the Standardized Pipeline
            pipeline = StandardizedReasoningPipeline(db=db, room_id=room_id)
            res = await pipeline.execute(goal=goal)
            
            # Broadcast reasoning update
            await manager.broadcast_global({
                "type": "investigation_update",
                "investigation_id": investigation_id,
                "status": "reasoning",
                "message": "Generating findings and hypothesis..."
            })
            
            await asyncio.sleep(2) # Simulate LLM thinking
            
            # Generate Report and Findings
            inv.status = "completed"
            inv.completed_at = datetime.utcnow()
            inv.findings = res.get("findings", [])
            
            markdown_report = f"# Autonomous Investigation Report\n\n**Goal:** {goal}\n\n"
            markdown_report += f"**Confidence Score:** {res.get('confidence', 0)}\n\n"
            markdown_report += "## Findings\n"
            for f in inv.findings:
                markdown_report += f"- {f}\n"
                
            inv.report_markdown = markdown_report
            await db.commit()
            
            # Broadcast completion
            await manager.broadcast_global({
                "type": "investigation_update",
                "investigation_id": investigation_id,
                "status": "completed",
                "message": "Investigation completed successfully!"
            })
            
        except Exception as e:
            logger.error(f"Investigation {investigation_id} failed: {e}")
            inv.status = "failed"
            await db.commit()
            await manager.broadcast_global({
                "type": "investigation_update",
                "investigation_id": investigation_id,
                "status": "failed",
                "message": "Investigation encountered a critical error."
            })


@router.post("/launch")
async def launch_investigation(
    payload: Dict[str, Any],
    background_tasks: BackgroundTasks,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db)
):
    goal = payload.get("goal")
    domain = payload.get("domain", "General")
    if not goal:
        raise HTTPException(status_code=400, detail="Goal is required")
        
    inv = Investigation(
        room_id=membership.room_id,
        user_id=membership.user.id,
        title=f"Investigation: {goal[:50]}...",
        goal=goal,
        domain=domain,
        status="active"
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    
    # Spawn background worker
    background_tasks.add_task(run_autonomous_investigation, inv.id, goal, membership.user.id, membership.room_id)
    
    return {"status": "launched", "investigation_id": inv.id}


@router.get("")
async def list_investigations(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Investigation)
        .where(Investigation.room_id == membership.room_id)
        .order_by(Investigation.created_at.desc())
    )
    investigations = result.scalars().all()
    return investigations


@router.get("/{investigation_id}")
async def get_investigation(
    investigation_id: int,
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Investigation)
        .where(Investigation.id == investigation_id)
        .where(Investigation.room_id == membership.room_id)
    )
    inv = result.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv
