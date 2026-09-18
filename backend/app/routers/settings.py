"""Settings router – user settings stored in PostgreSQL."""

import os
import json
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User
from app.utils.security import get_current_user
from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership

router = APIRouter()


class SettingsUpdate(BaseModel):
    key: str
    value: str


@router.get("")
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user settings, merged with defaults."""
    defaults = {
        "ollama_endpoint": settings.OLLAMA_ENDPOINT,
        "ollama_model": settings.OLLAMA_MODEL,
        "theme": "dark",
    }

    result = await db.execute(
        text("SELECT key, value FROM settings WHERE user_id = :user_id"),
        {"user_id": current_user.id},
    )
    rows = result.fetchall()

    # Merge DB values over defaults
    for row in rows:
        defaults[row[0]] = row[1]

    return defaults


@router.put("")
async def update_settings(
    body: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upsert a single setting for the current user."""
    await db.execute(
        text(
            "INSERT INTO settings (key, value, user_id) VALUES (:key, :value, :user_id) "
            "ON CONFLICT (key, user_id) DO UPDATE SET value = :value"
        ),
        {"key": body.key, "value": body.value, "user_id": current_user.id},
    )
    await db.flush()

    return {"success": True}


@router.delete("/clear-graph")
async def clear_knowledge_graph(
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Clear all entities and relationships from Neo4j with backup for this room."""
    from app.neo4j_driver import get_neo4j_driver
    from app.models import Activity
    
    driver = get_neo4j_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Graph database unavailable")

    # 1. Backup Neo4j graph before deleting
    backup_data = {"nodes": [], "relationships": []}
    with driver.session() as session:
        # Get all nodes in the current room
        node_res = session.run(
            "MATCH (n:Entity {room_id: $room_id}) "
            "RETURN n.id AS id, n.name AS name, n.type AS type, n.description AS description, "
            "n.properties AS properties, n.created_at AS created_at, n.source_document_id AS source_document_id",
            room_id=membership.room_id
        )
        for record in node_res:
            backup_data["nodes"].append(dict(record))
            
        # Get all relationships in the current room
        rel_res = session.run(
            "MATCH (s:Entity {room_id: $room_id})-[r]->(t:Entity {room_id: $room_id}) "
            "RETURN s.id AS source_id, type(r) AS neo4j_type, r.id AS id, r.type AS type, "
            "r.description AS description, r.created_at AS created_at, t.id AS target_id",
            room_id=membership.room_id
        )
        for record in rel_res:
            backup_data["relationships"].append(dict(record))
            
    # Save backup to room-specific file
    backup_path = os.path.join(settings.UPLOAD_DIR, f"graph_backup_room_{membership.room_id}.json")
    with open(backup_path, "w") as f:
        json.dump(backup_data, f)
        
    # 2. Reset document extraction statuses in Postgres for this room
    await db.execute(
        text(
            "UPDATE documents SET status = 'uploaded', entity_count = 0, "
            "extracted_entities = '[]'::jsonb, extracted_relationships = '[]'::jsonb "
            "WHERE room_id = :room_id"
        ),
        {"room_id": membership.room_id}
    )
    
    # 3. Log activity
    activity = Activity(
        room_id=membership.room_id,
        action="deleted",
        entity_type="system",
        entity_id="all",
        details="Cleared the knowledge graph for this room",
        user_id=membership.user.id,
    )
    db.add(activity)
    await db.flush()

    # 4. Clear Neo4j graph for this room
    with driver.session() as session:
        session.run(
            "MATCH (n {room_id: $room_id}) DETACH DELETE n",
            room_id=membership.room_id
        )

    return {"success": True}


@router.get("/graph-backup-status")
async def get_backup_status(membership: RoomMembership = Depends(get_room_membership)):
    """Check if a valid graph backup exists and when it expires."""
    backup_path = os.path.join(settings.UPLOAD_DIR, f"graph_backup_room_{membership.room_id}.json")
    if not os.path.exists(backup_path):
        return {"has_backup": False, "expires_in_minutes": 0}
        
    mtime = os.path.getmtime(backup_path)
    age_seconds = time.time() - mtime
    max_age = 3600 # 1 hour
    
    if age_seconds > max_age:
        os.remove(backup_path)
        return {"has_backup": False, "expires_in_minutes": 0}
        
    expires_in_minutes = int((max_age - age_seconds) / 60)
    return {"has_backup": True, "expires_in_minutes": expires_in_minutes}


@router.post("/undo-clear-graph")
async def undo_clear_graph(
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Restore the graph from backup."""
    from app.neo4j_driver import get_neo4j_driver
    from app.models import Activity
    
    backup_path = os.path.join(settings.UPLOAD_DIR, f"graph_backup_room_{membership.room_id}.json")
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=400, detail="No backup found to restore")
        
    with open(backup_path, "r") as f:
        backup_data = json.load(f)
        
    driver = get_neo4j_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Graph database unavailable")
        
    with driver.session() as session:
        # Re-create nodes
        for node in backup_data.get("nodes", []):
            type_label = node.get("type", "").strip().replace(" ", "_")
            if not type_label:
                type_label = "Unknown"
            session.run(
                f"CREATE (e:Entity:{type_label} {{"
                f"id: $id, name: $name, type: $type, description: $description, "
                f"properties: $properties, created_at: $created_at, "
                f"source_document_id: $source_document_id, room_id: $room_id"
                f"}})",
                id=node.get("id"), name=node.get("name"), type=node.get("type"), 
                description=node.get("description"), properties=node.get("properties"),
                created_at=node.get("created_at"), source_document_id=node.get("source_document_id"),
                room_id=membership.room_id
            )
            
        # Re-create relationships
        for rel in backup_data.get("relationships", []):
            neo4j_type = rel.get("neo4j_type", "RELATED_TO")
            session.run(
                f"MATCH (s:Entity {{id: $source_id, room_id: $room_id}}), (t:Entity {{id: $target_id, room_id: $room_id}}) "
                f"CREATE (s)-[:`{neo4j_type}` {{id: $id, type: $type, description: $description, created_at: $created_at}}]->(t)",
                source_id=rel.get("source_id"), target_id=rel.get("target_id"), 
                id=rel.get("id"), type=rel.get("type"), 
                description=rel.get("description", ""), created_at=rel.get("created_at"),
                room_id=membership.room_id
            )
            
    # Delete backup
    os.remove(backup_path)
    
    # Log activity
    activity = Activity(
        room_id=membership.room_id,
        action="created",
        entity_type="system",
        entity_id="all",
        details="Restored knowledge graph from backup for this room",
        user_id=membership.user.id,
    )
    db.add(activity)
    await db.flush()
    
    return {"success": True}
