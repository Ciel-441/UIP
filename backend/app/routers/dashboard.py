"""Dashboard router – aggregate stats, recent activity, and growth data."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Activity, Document, User
from app.neo4j_driver import get_neo4j_driver
from app.utils.security import get_current_user
from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership, MembershipStatus
from sqlalchemy.orm import selectinload

router = APIRouter()


@router.get("/stats")
async def get_stats(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Return high-level counts: entities, relationships, documents, recent activity for this room."""
    driver = get_neo4j_driver()

    # Neo4j counts (synchronous)
    total_entities = 0
    total_relationships = 0
    entity_distribution = []
    if driver:
        with driver.session() as session:
            result = session.run(
                "MATCH (e:Entity {room_id: $room_id}) RETURN count(e) AS cnt",
                room_id=membership.room_id
            )
            record = result.single()
            if record:
                total_entities = record["cnt"]

            result = session.run(
                "MATCH (:Entity {room_id: $room_id})-[r]->(:Entity {room_id: $room_id}) RETURN count(r) AS cnt",
                room_id=membership.room_id
            )
            record = result.single()
            if record:
                total_relationships = record["cnt"]

            # Entity distribution by type
            result = session.run(
                "MATCH (e:Entity {room_id: $room_id}) RETURN e.type AS type, count(e) AS cnt",
                room_id=membership.room_id
            )
            for record in result:
                if record["type"]:
                    entity_distribution.append({
                        "name": record["type"],
                        "value": record["cnt"]
                    })

    # PostgreSQL counts
    doc_result = await db.execute(
        select(func.count(Document.id)).where(Document.room_id == membership.room_id)
    )
    total_documents = doc_result.scalar() or 0

    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    activity_result = await db.execute(
        select(func.count(Activity.id))
        .where(Activity.room_id == membership.room_id)
        .where(Activity.created_at >= seven_days_ago)
    )
    recent_activity_count = activity_result.scalar() or 0

    return {
        "total_entities": total_entities,
        "total_relationships": total_relationships,
        "total_documents": total_documents,
        "recent_activity_count": recent_activity_count,
        "entity_distribution": entity_distribution,
    }


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = Query(10, ge=1, le=100),
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent activity log entries for this room."""
    result = await db.execute(
        select(Activity, User.name.label("user_name"))
        .outerjoin(User, Activity.user_id == User.id)
        .where(Activity.room_id == membership.room_id)
        .order_by(Activity.created_at.desc())
        .limit(limit)
    )
    rows = result.all()

    return {
        "activities": [
            {
                "id": row.Activity.id,
                "action": row.Activity.action,
                "entity_type": row.Activity.entity_type,
                "entity_id": row.Activity.entity_id,
                "details": row.Activity.details,
                "created_at": row.Activity.created_at.isoformat() if row.Activity.created_at else None,
                "user_id": row.Activity.user_id,
                "user_name": row.user_name or "System",
            }
            for row in rows
        ]
    }


@router.get("/growth")
async def get_growth(
    membership: RoomMembership = Depends(get_room_membership),
):
    """Return entity & relationship counts grouped by date for the last 30 days for this room."""
    driver = get_neo4j_driver()
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

    data: dict[str, dict[str, int]] = {}
    
    # Initialize the last 30 days with zeros so the chart always renders a full timeline
    for i in range(30, -1, -1):
        date_key = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        data[date_key] = {"entities": 0, "relationships": 0}

    if driver:
        with driver.session() as session:
            # Entities grouped by date
            result = session.run(
                """
                MATCH (e:Entity {room_id: $room_id})
                WHERE e.created_at >= $since
                WITH left(e.created_at, 10) AS d, count(e) AS cnt
                RETURN d AS date, cnt
                ORDER BY date
                """,
                since=thirty_days_ago,
                room_id=membership.room_id
            )
            for record in result:
                date_str = record["date"]
                data.setdefault(date_str, {"entities": 0, "relationships": 0})
                data[date_str]["entities"] = record["cnt"]

            # Relationships grouped by date
            result = session.run(
                """
                MATCH (:Entity {room_id: $room_id})-[r]->(:Entity {room_id: $room_id})
                WHERE r.created_at >= $since
                WITH left(r.created_at, 10) AS d, count(r) AS cnt
                RETURN d AS date, cnt
                ORDER BY date
                """,
                since=thirty_days_ago,
                room_id=membership.room_id
            )
            for record in result:
                date_str = record["date"]
                data.setdefault(date_str, {"entities": 0, "relationships": 0})
                data[date_str]["relationships"] = record["cnt"]

    return {
        "data": [
            {"date": d, "entities": v["entities"], "relationships": v["relationships"]}
            for d, v in sorted(data.items())
        ]
    }


@router.get("/audit-logs")
async def get_audit_logs(
    user_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    membership: RoomMembership = Depends(require_room_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return detailed audit log (activity) entries for the admin panel, optionally filtered by user."""
    stmt = (
        select(Activity, User.name.label("user_name"), User.email.label("user_email"), User.pfp_url.label("user_pfp_url"))
        .outerjoin(User, Activity.user_id == User.id)
        .where(Activity.room_id == membership.room_id)
    )
    
    if user_id is not None:
        stmt = stmt.where(Activity.user_id == user_id)
        
    stmt = stmt.order_by(Activity.created_at.desc()).offset(offset).limit(limit)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    return {
        "logs": [
            {
                "id": row.Activity.id,
                "action": row.Activity.action,
                "entity_type": row.Activity.entity_type,
                "entity_id": row.Activity.entity_id,
                "details": row.Activity.details,
                "created_at": row.Activity.created_at.isoformat() if row.Activity.created_at else None,
                "user_id": row.Activity.user_id,
                "user_name": row.user_name or "System",
                "user_email": row.user_email or "",
                "user_pfp_url": row.user_pfp_url,
            }
            for row in rows
        ]
    }


@router.get("/contribution-stats")
async def get_contribution_stats(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated contribution statistics for each collaborator in the workspace."""
    # 1. Fetch all approved members for this room
    result = await db.execute(
        select(RoomMembership)
        .options(selectinload(RoomMembership.user))
        .where(
            RoomMembership.room_id == membership.room_id,
            RoomMembership.status == MembershipStatus.approved,
        )
    )
    memberships = result.scalars().all()
    
    # Map user_id to user name/email/pfp_url/role
    user_meta = {}
    for m in memberships:
        if m.user:
            user_meta[m.user_id] = {
                "id": m.user_id,
                "name": m.user.name,
                "email": m.user.email,
                "pfp_url": m.user.pfp_url,
                "role": m.role.value,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            }
            
    # 2. Query activity counts grouped by user_id and (action, entity_type)
    stmt = (
        select(
            Activity.user_id,
            Activity.action,
            Activity.entity_type,
            func.count(Activity.id).label("count"),
            func.max(Activity.created_at).label("last_active")
        )
        .where(Activity.room_id == membership.room_id)
        .group_by(Activity.user_id, Activity.action, Activity.entity_type)
    )
    res = await db.execute(stmt)
    rows = res.all()
    
    # 3. Fetch all documents in this room to associate concrete artifacts
    doc_stmt = (
        select(Document.id, Document.original_name, Document.user_id, Document.created_at)
        .where(Document.room_id == membership.room_id)
        .order_by(Document.created_at.desc())
    )
    doc_res = await db.execute(doc_stmt)
    docs = doc_res.all()
    
    docs_map = {}
    for doc_id, doc_name, user_id, created_at in docs:
        if user_id not in docs_map:
            docs_map[user_id] = []
        docs_map[user_id].append({
            "id": doc_id,
            "name": doc_name,
            "created_at": created_at.isoformat() if created_at else None
        })
        
    # Aggregate data
    user_stats = {}
    total_room_activities = 0
    total_room_score = 0
    
    for u_id in user_meta.keys():
        user_stats[u_id] = {
            "user": user_meta[u_id],
            "entities_created": 0,
            "relationships_created": 0,
            "documents_uploaded": len(docs_map.get(u_id, [])),  # actual existing docs, not activity count
            "contribution_score": 0,
            "total_activities": 0,
            "last_active": None,
            "contributed_documents": docs_map.get(u_id, [])
        }
        
    # Score weights for constructive actions
    SCORE_WEIGHTS = {
        ("created", "entity"): 3,
        ("created", "relationship"): 2,
        ("created", "document"): 5,
        ("bulk_imported", None): 3,  # matched below
        ("merged", "entity"): 2,
    }
        
    for row in rows:
        u_id = row[0]
        action = row[1]
        e_type = row[2]
        count = row[3]
        last_act = row[4]
        
        if u_id not in user_stats:
            continue
            
        entry = user_stats[u_id]
        entry["total_activities"] += count
        total_room_activities += count
        
        if last_act:
            if not entry["last_active"] or last_act > entry["last_active"]:
                entry["last_active"] = last_act
                
        # Only count constructive actions towards score
        weight = SCORE_WEIGHTS.get((action, e_type), 0)
        if action == "bulk_imported":
            weight = SCORE_WEIGHTS.get(("bulk_imported", None), 0)
        if weight > 0:
            entry["contribution_score"] += count * weight
            total_room_score += count * weight
                
        # Categorize contribution types (entities & relationships from activities)
        if action == "created":
            if e_type == "entity":
                entry["entities_created"] += count
            elif e_type == "relationship":
                entry["relationships_created"] += count
        elif action == "bulk_imported":
            entry["entities_created"] += count
            
    # Convert map to list and serialize last_active
    stats_list = list(user_stats.values())
    for entry in stats_list:
        if entry["last_active"] and hasattr(entry["last_active"], "isoformat"):
            entry["last_active"] = entry["last_active"].isoformat()
    
    # Sort by contribution score descending
    stats_list.sort(key=lambda x: x["contribution_score"], reverse=True)
    
    return {
        "total_activities": total_room_activities,
        "total_score": total_room_score,
        "user_stats": stats_list
    }
