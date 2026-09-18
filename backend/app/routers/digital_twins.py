from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.models.intelligence import DigitalTwin, Scenario, Simulation
from app.core.predictive_pipeline import UnifiedFutureModelingOrchestrator
from app.core.decision_orchestrator import ImplementationPlannerAgent

router = APIRouter()

# --- Pydantic Schemas ---
class DigitalTwinCreate(BaseModel):
    name: str
    description: str
    domain: str
    parameters: Dict[str, Any]

class ScenarioCreate(BaseModel):
    title: str
    description: str
    parameters: Dict[str, Any]

class OptimizeRequest(BaseModel):
    goal: str
    num_strategies: int = 3

class PlanRequest(BaseModel):
    strategy: Dict[str, Any]

# --- Routes ---

@router.get("", response_model=List[Dict[str, Any]])
async def list_digital_twins(
    db: AsyncSession = Depends(get_db),
    membership: RoomMembership = Depends(get_room_membership),
):
    """List all Digital Twins."""
    result = await db.execute(select(DigitalTwin).where(DigitalTwin.room_id == membership.room_id))
    twins = result.scalars().all()
    print(f"DEBUG: Found {len(twins)} twins in DB for user {membership.user.email}")
    for t in twins:
        print(f"DEBUG: Twin ID: {t.id}, Name: {t.name}")
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "domain": t.domain,
            "health_score": t.health_score,
        }
        for t in twins
    ]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_digital_twin(
    twin_data: DigitalTwinCreate,
    db: AsyncSession = Depends(get_db),
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
):
    """Create a new Digital Twin."""
    twin = DigitalTwin(room_id=membership.room_id, **twin_data.model_dump())
    db.add(twin)
    await db.commit()
    await db.refresh(twin)
    return twin

@router.post("/{twin_id}/scenarios", status_code=status.HTTP_201_CREATED)
async def create_scenario(
    twin_id: int,
    scenario_data: ScenarioCreate,
    db: AsyncSession = Depends(get_db),
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
):
    """Create a scenario for a twin."""
    twin_result = await db.execute(select(DigitalTwin).filter(DigitalTwin.id == twin_id, DigitalTwin.room_id == membership.room_id))
    if not twin_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Digital Twin not found")
        
    scenario = Scenario(room_id=membership.room_id, twin_id=twin_id, **scenario_data.model_dump())
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario

@router.post("/{twin_id}/simulate/{scenario_id}")
async def run_simulation(
    twin_id: int,
    scenario_id: int,
    db: AsyncSession = Depends(get_db),
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
):
    """Run a predictive simulation on a specific scenario for a twin."""
    twin_result = await db.execute(select(DigitalTwin).filter(DigitalTwin.id == twin_id, DigitalTwin.room_id == membership.room_id))
    twin = twin_result.scalar_one_or_none()
    
    scenario_result = await db.execute(
        select(Scenario).filter(
            Scenario.id == scenario_id,
            Scenario.twin_id == twin_id,
            Scenario.room_id == membership.room_id
        )
    )
    scenario = scenario_result.scalar_one_or_none()
    
    if not twin or not scenario:
        raise HTTPException(status_code=404, detail="Twin or Scenario not found")
        
    # Execute the Unified Future Modeling Pipeline
    results = await UnifiedFutureModelingOrchestrator.execute_full_pipeline(
        twin_data=twin.parameters,
        scenario_parameters=scenario.parameters
    )
    
    # Save the simulation results
    simulation = Simulation(
        room_id=membership.room_id,
        scenario_ids=[scenario_id],
        status="completed",
        results=results
    )
    db.add(simulation)
    await db.commit()
    await db.refresh(simulation)
    
    return simulation

@router.post("/{twin_id}/optimize")
async def optimize_goal(
    twin_id: int,
    request: OptimizeRequest,
    db: AsyncSession = Depends(get_db),
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
):
    """Run Goal-Driven Optimizer to generate competing strategies."""
    twin_result = await db.execute(select(DigitalTwin).filter(DigitalTwin.id == twin_id, DigitalTwin.room_id == membership.room_id))
    twin = twin_result.scalar_one_or_none()
    if not twin:
        raise HTTPException(status_code=404, detail="Twin not found")
        
    results = await UnifiedFutureModelingOrchestrator.solve_for_goal(
        goal=request.goal,
        twin_data=twin.parameters,
        num_strategies=request.num_strategies
    )
    return results

@router.post("/{twin_id}/plan")
async def generate_plan(
    twin_id: int,
    request: PlanRequest,
    db: AsyncSession = Depends(get_db),
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
):
    """Generate an implementation plan for a chosen strategy."""
    twin_result = await db.execute(select(DigitalTwin).filter(DigitalTwin.id == twin_id, DigitalTwin.room_id == membership.room_id))
    twin = twin_result.scalar_one_or_none()
    if not twin:
        raise HTTPException(status_code=404, detail="Twin not found")
        
    plan = await ImplementationPlannerAgent.run(
        strategy=request.strategy,
        twin_data=twin.parameters
    )
    return plan
