from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.models.intelligence import RiskAssessment, Forecast, Strategy

router = APIRouter()

@router.get("/risks", response_model=List[Dict[str, Any]])
async def get_risks(
    db: AsyncSession = Depends(get_db),
    membership: RoomMembership = Depends(get_room_membership),
):
    """Get all identified risks."""
    result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.room_id == membership.room_id)
        .order_by(RiskAssessment.generated_at.desc())
    )
    risks = result.scalars().all()
    return [
        {
            "id": r.id,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "risk_score": r.risk_score,
            "risk_type": r.risk_type,
            "description": r.description,
            "generated_at": r.generated_at,
        }
        for r in risks
    ]

@router.get("/forecasts", response_model=List[Dict[str, Any]])
async def get_forecasts(
    db: AsyncSession = Depends(get_db),
    membership: RoomMembership = Depends(get_room_membership),
):
    """Get all forecasts. Includes disclaimers."""
    result = await db.execute(
        select(Forecast)
        .where(Forecast.room_id == membership.room_id)
        .order_by(Forecast.created_at.desc())
    )
    forecasts = result.scalars().all()
    return [
        {
            "id": f.id,
            "twin_id": f.twin_id,
            "target_metric": f.target_metric,
            "predicted_value": f.predicted_value,
            "timeframe_days": f.timeframe_days,
            "confidence": f.confidence,
            "assumptions": f.assumptions,
            "evidence": f.evidence,
            "data_coverage": f.data_coverage,
            "disclaimer": "Predictions are estimates, not truths. Do not present as fact.",
        }
        for f in forecasts
    ]

@router.get("/strategies", response_model=List[Dict[str, Any]])
async def get_strategies(
    db: AsyncSession = Depends(get_db),
    membership: RoomMembership = Depends(get_room_membership),
):
    """Get all generated strategies."""
    result = await db.execute(
        select(Strategy)
        .where(Strategy.room_id == membership.room_id)
        .order_by(Strategy.created_at.desc())
    )
    strategies = result.scalars().all()
    return [
        {
            "id": s.id,
            "goal": s.goal,
            "recommended_actions": s.recommended_actions,
            "predicted_impact": s.predicted_impact,
            "confidence": s.confidence,
            "trade_offs": s.trade_offs,
        }
        for s in strategies
    ]
