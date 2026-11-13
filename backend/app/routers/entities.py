"""Entities router – CRUD for Neo4j entity nodes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, Activity
from app.schemas.entity import (
    EntityCreate,
    EntityUpdate,
    EntityResponse,
    EntityListResponse,
    EntityDetailResponse,
    EntityMergeRequest,
)
from app.services import entity_service, resolution_service
from app.utils.security import get_current_user
from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership

router = APIRouter()


@router.get("", response_model=EntityListResponse)
async def list_entities(
    type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    as_of_date: Optional[str] = None,
    membership: RoomMembership = Depends(get_room_membership),
):
    """List entities with optional filtering by type, search query, and temporal valid_from filtering."""
    items, total = entity_service.list_entities(
        type_filter=type,
        search=search,
        limit=limit,
        offset=offset,
        as_of_date=as_of_date,
        room_id=membership.room_id,
    )
    return {"items": items, "total": total}


@router.post("", response_model=EntityResponse, status_code=status.HTTP_201_CREATED)
async def create_entity(
    entity_data: EntityCreate,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new entity and log the activity."""
    entity = entity_service.create_entity(
        name=entity_data.name,
        type=entity_data.type,
        description=entity_data.description,
        properties=entity_data.properties,
        room_id=membership.room_id,
    )

    # Log activity
    activity = Activity(
        room_id=membership.room_id,
        action="created",
        entity_type="entity",
        entity_id=str(entity.get("id", "")),
        details=f"Created entity: {entity_data.name}",
        user_id=membership.user.id,
    )
    db.add(activity)
    await db.flush()

    return entity


@router.get("/{entity_id}", response_model=EntityDetailResponse)
async def get_entity(
    entity_id: str,
    as_of_date: Optional[str] = None,
    membership: RoomMembership = Depends(get_room_membership),
):
    """Get a single entity with its connections, optionally filtered by time."""
    entity = entity_service.get_entity(room_id=membership.room_id, entity_id=entity_id)
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity {entity_id} not found",
        )
    connections = entity_service.get_entity_connections(room_id=membership.room_id, entity_id=entity_id, as_of_date=as_of_date)
    entity["connections"] = connections
    return entity


@router.put("/{entity_id}", response_model=EntityResponse)
async def update_entity(
    entity_id: str,
    entity_data: EntityUpdate,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
):
    """Update an existing entity."""
    updates = entity_data.model_dump(exclude_unset=True)
    entity = entity_service.update_entity(room_id=membership.room_id, entity_id=entity_id, updates=updates)
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity {entity_id} not found",
        )
    return entity


@router.get("/tools/duplicates")
async def get_duplicates(
    threshold: float = 0.8,
    membership: RoomMembership = Depends(get_room_membership),
):
    """Get suggested duplicate entities based on name similarity."""
    return resolution_service.find_duplicate_entities(room_id=membership.room_id, similarity_threshold=threshold)


@router.post("/tools/merge", response_model=EntityResponse)
async def merge_entities(
    req: EntityMergeRequest,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Merge source entity into target entity."""
    try:
        target_name = "Unknown"
        source_name = "Unknown"
        target_entity = entity_service.get_entity(room_id=membership.room_id, entity_id=req.target_id)
        source_entity = entity_service.get_entity(room_id=membership.room_id, entity_id=req.source_id)
        if target_entity:
            target_name = target_entity.get("name", "Unknown")
        if source_entity:
            source_name = source_entity.get("name", "Unknown")

        merged_entity = resolution_service.merge_entities(room_id=membership.room_id, target_id=req.target_id, source_id=req.source_id)
        
        # Log activity
        activity = Activity(
            room_id=membership.room_id,
            action="merged",
            entity_type="entity",
            entity_id=req.target_id,
            details=f"Merged entity '{source_name}' into '{target_name}'",
            user_id=membership.user.id,
        )
        db.add(activity)
        await db.flush()
        
        return merged_entity
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{entity_id}")
async def delete_entity(
    entity_id: str,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Delete an entity and log the activity."""
    entity_name = "Unknown"
    entity = entity_service.get_entity(room_id=membership.room_id, entity_id=entity_id)
    if entity:
        entity_name = entity.get("name", "Unknown")

    result = entity_service.delete_entity(room_id=membership.room_id, entity_id=entity_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity {entity_id} not found",
        )

    # Log activity
    activity = Activity(
        room_id=membership.room_id,
        action="deleted",
        entity_type="entity",
        entity_id=str(entity_id),
        details=f"Deleted entity '{entity_name}'",
        user_id=membership.user.id,
    )
    db.add(activity)
    await db.flush()

    return {"success": True}
