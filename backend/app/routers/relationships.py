"""Relationships router – CRUD for Neo4j relationship edges."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, Activity
from app.schemas.relationship import (
    RelationshipCreate,
    RelationshipResponse,
    RelationshipListResponse,
)
from app.services import relationship_service
from app.utils.security import get_current_user
from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership

router = APIRouter()


@router.get("", response_model=RelationshipListResponse)
async def list_relationships(
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    membership: RoomMembership = Depends(get_room_membership),
):
    """List relationships with optional filters."""
    items, total = relationship_service.list_relationships(
        source_id=source_id,
        target_id=target_id,
        type_filter=type,
        limit=limit,
        offset=offset,
        room_id=membership.room_id,
    )
    return {"items": items, "total": total}


@router.post("", response_model=RelationshipResponse, status_code=status.HTTP_201_CREATED)
async def create_relationship(
    rel_data: RelationshipCreate,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new relationship between two entities."""
    rel = relationship_service.create_relationship(
        type=rel_data.type,
        source_id=rel_data.source_id,
        target_id=rel_data.target_id,
        description=rel_data.description,
        room_id=membership.room_id,
    )
    if not rel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create relationship. Check source and target entity IDs.",
        )

    # Log activity
    activity = Activity(
        room_id=membership.room_id,
        action="created",
        entity_type="relationship",
        entity_id=str(rel.get("id", "")),
        details=f"Created relationship: {rel.get('source_name', '')} -> {rel.get('target_name', '')}",
        user_id=membership.user.id,
    )
    db.add(activity)
    await db.flush()

    return rel


@router.delete("/{relationship_id}")
async def delete_relationship(
    relationship_id: str,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a relationship."""
    rel_name = "Unknown"
    rel = relationship_service.get_relationship(room_id=membership.room_id, rel_id=relationship_id)
    if rel:
        rel_name = f"{rel.get('source_name', '')} -> {rel.get('type', '').replace('_', ' ')} -> {rel.get('target_name', '')}"

    result = relationship_service.delete_relationship(room_id=membership.room_id, rel_id=relationship_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Relationship {relationship_id} not found",
        )

    # Log activity
    activity = Activity(
        room_id=membership.room_id,
        action="deleted",
        entity_type="relationship",
        entity_id=str(relationship_id),
        details=f"Deleted relationship: '{rel_name}'",
        user_id=membership.user.id,
    )
    db.add(activity)
    await db.flush()

    return {"success": True}


@router.post("/auto-link")
async def auto_link_relationships(
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Scan the graph for orphan entities and automatically link them in the background."""
    from app.services.discovery_engine import auto_link_orphans
    from app.neo4j_driver import get_neo4j_driver
    
    driver = get_neo4j_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Graph database unavailable")
        
    # Trigger auto-linking
    linked_count = await auto_link_orphans(room_id=membership.room_id, driver=driver, user_id=membership.user.id, db=db)
    
    return {"success": True, "linked_count": linked_count}
