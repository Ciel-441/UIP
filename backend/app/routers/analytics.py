"""Analytics router – entity growth, most connected, most referenced."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, Document
from app.neo4j_driver import get_neo4j_driver
from app.utils.security import get_current_user
from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership
from app.services import graph_analytics_service
from app.models import Activity

router = APIRouter()


@router.get("/entity-growth")
async def entity_growth(
    membership: RoomMembership = Depends(get_room_membership),
):
    """Entity counts grouped by creation date and type."""
    from collections import defaultdict
    driver = get_neo4j_driver()
    data = []

    if driver:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (e:Entity {room_id: $room_id})
                WITH left(e.created_at, 10) AS d, e.type AS type, count(e) AS cnt
                RETURN d AS date, cnt AS count, type
                ORDER BY date
                """,
                room_id=membership.room_id
            )
            from datetime import datetime, timedelta
            pivot = defaultdict(dict)
            
            # Initialize last 30 days
            for i in range(30, -1, -1):
                date_key = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
                pivot[date_key] = {"date": date_key}
                
            for record in result:
                date_str = record["date"]
                if date_str:
                    pivot[date_str]["date"] = date_str
                    pivot[date_str][record["type"]] = record["count"]

            data = list(pivot.values())
            data.sort(key=lambda x: x["date"])

    return {"data": data}


@router.get("/most-connected")
async def most_connected(
    limit: int = Query(10, ge=1, le=50),
    membership: RoomMembership = Depends(get_room_membership),
):
    """Entities with the most connections (incoming + outgoing relationships)."""
    driver = get_neo4j_driver()
    data = []

    if driver:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (e:Entity {room_id: $room_id})
                OPTIONAL MATCH (e)-[r1]->() WHERE r1.room_id = $room_id
                OPTIONAL MATCH ()-[r2]->(e) WHERE r2.room_id = $room_id
                WITH e, count(DISTINCT r1) + count(DISTINCT r2) AS connection_count
                RETURN e.id AS id, e.name AS name, e.type AS type, connection_count
                ORDER BY connection_count DESC
                LIMIT $limit
                """,
                limit=limit, room_id=membership.room_id
            )
            for record in result:
                data.append({
                    "id": record["id"],
                    "name": record["name"],
                    "type": record["type"],
                    "connection_count": record["connection_count"],
                })

    return {"data": data}


@router.get("/most-referenced")
async def most_referenced(
    limit: int = Query(10, ge=1, le=50),
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Documents with the highest entity counts."""
    result = await db.execute(
        select(Document)
        .where(Document.entity_count > 0)
        .where(Document.room_id == membership.room_id)
        .order_by(Document.entity_count.desc())
        .limit(limit)
    )
    documents = result.scalars().all()
    data = []
    for doc in documents:
        data.append({
            "id": doc.id,
            "filename": doc.filename,
            "original_name": doc.original_name,
            "entity_count": doc.entity_count,
        })

    return {"data": data}


@router.get("/shortest-path")
async def shortest_path(
    source_id: str = Query(...),
    target_id: str = Query(...),
    max_depth: int = Query(5, ge=1, le=10),
    membership: RoomMembership = Depends(get_room_membership),
):
    """Get the shortest path between two entities."""
    return graph_analytics_service.get_shortest_path(source_id, target_id, max_depth, room_id=membership.room_id)


@router.get("/neighbors/{entity_id}")
async def entity_neighbors(
    entity_id: str,
    depth: int = Query(1, ge=1, le=3),
    membership: RoomMembership = Depends(get_room_membership),
):
    """Get neighbors of an entity up to a certain depth."""
    return graph_analytics_service.get_neighbors(entity_id, depth, room_id=membership.room_id)


@router.get("/communities")
async def communities(
    membership: RoomMembership = Depends(get_room_membership),
):
    """Get community detection results."""
    return graph_analytics_service.get_community_detection(room_id=membership.room_id)

@router.get("/recommendations")
async def recommendations(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Get entity recommendations based on recent user activity."""
    # 1. Fetch user's recent activity to see what they interacted with
    result = await db.execute(
        select(Activity)
        .where(Activity.user_id == membership.user.id)
        .where(Activity.room_id == membership.room_id)
        .where(Activity.entity_type == "entity")
        .order_by(Activity.created_at.desc())
        .limit(10)
    )
    activities = result.scalars().all()
    
    recent_entity_ids = []
    for act in activities:
        if act.entity_id and act.entity_id not in recent_entity_ids:
            recent_entity_ids.append(act.entity_id)
            
    # 2. Query Neo4j for neighbors of these entities (Collaborative Filtering / Content-based)
    driver = get_neo4j_driver()
    recommendations = []
    if driver and recent_entity_ids:
        with driver.session() as session:
            # Find entities that are connected to the recently interacted entities, but exclude the recent ones themselves
            query = """
            MATCH (e:Entity {room_id: $room_id})-[r]-(neighbor:Entity {room_id: $room_id})
            WHERE e.id IN $recent_ids AND NOT neighbor.id IN $recent_ids
            RETURN neighbor.id AS id, neighbor.name AS name, neighbor.type AS type, count(r) AS weight
            ORDER BY weight DESC
            LIMIT 5
            """
            rec_result = session.run(query, recent_ids=recent_entity_ids, room_id=membership.room_id)
            for rec in rec_result:
                recommendations.append({
                    "id": rec["id"],
                    "name": rec["name"],
                    "type": rec["type"],
                    "reason": "Based on your recent activity"
                })
                
    # If no recommendations, return global popular
    if not recommendations and driver:
         with driver.session() as session:
            query = """
            MATCH (e:Entity {room_id: $room_id})-[r]-()
            RETURN e.id AS id, e.name AS name, e.type AS type, count(r) AS weight
            ORDER BY weight DESC
            LIMIT 5
            """
            rec_result = session.run(query, room_id=membership.room_id)
            for rec in rec_result:
                recommendations.append({
                    "id": rec["id"],
                    "name": rec["name"],
                    "type": rec["type"],
                    "reason": "Popular in the graph"
                })
                
    return {"data": recommendations}


@router.get("/knowledge-gaps")
async def knowledge_gaps(
    limit: int = Query(5, ge=1, le=20),
    membership: RoomMembership = Depends(get_room_membership),
):
    """Detect areas in the graph that need more evidence or context."""
    driver = get_neo4j_driver()
    gaps = []
    
    if driver:
        with driver.session() as session:
            # 1. Isolated Entities
            iso_query = """
            MATCH (e:Entity {room_id: $room_id})
            WHERE NOT (e)-[]-(:Entity {room_id: $room_id})
            RETURN e.id AS id, e.name AS name, e.type AS type
            LIMIT 2
            """
            for rec in session.run(iso_query, room_id=membership.room_id):
                gaps.append({
                    "id": rec["id"],
                    "name": rec["name"],
                    "type": rec["type"],
                    "reason": "Isolated entity with no connections"
                })
                
            # 2. Missing Context (No description)
            ctx_query = """
            MATCH (e:Entity {room_id: $room_id})
            WHERE e.description IS NULL OR e.description = ""
            RETURN e.id AS id, e.name AS name, e.type AS type
            LIMIT 2
            """
            for rec in session.run(ctx_query, room_id=membership.room_id):
                gaps.append({
                    "id": rec["id"],
                    "name": rec["name"],
                    "type": rec["type"],
                    "reason": "Missing description context"
                })
                
            # 3. Low Confidence
            conf_query = """
            MATCH (e:Entity {room_id: $room_id})
            WHERE e.confidence_score < 0.7
            RETURN e.id AS id, e.name AS name, e.type AS type
            LIMIT 2
            """
            for rec in session.run(conf_query, room_id=membership.room_id):
                gaps.append({
                    "id": rec["id"],
                    "name": rec["name"],
                    "type": rec["type"],
                    "reason": "Low AI confidence score"
                })
                
    # If not enough specific gaps, return some random entities asking to verify them
    if len(gaps) < 3 and driver:
        with driver.session() as session:
            rand_query = """
            MATCH (e:Entity {room_id: $room_id})
            RETURN e.id AS id, e.name AS name, e.type AS type
            ORDER BY rand()
            LIMIT 2
            """
            for rec in session.run(rand_query, room_id=membership.room_id):
                # Avoid duplicates
                if not any(g["id"] == rec["id"] for g in gaps):
                    gaps.append({
                        "id": rec["id"],
                        "name": rec["name"],
                        "type": rec["type"],
                        "reason": "Needs manual review"
                    })
                    
    return {"data": gaps[:limit]}

from app.services import reasoning_engine

@router.get("/contradictions")
async def get_contradictions(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Phase 2: Detect graph contradictions and synthesize via LLM."""
    return await reasoning_engine.detect_contradictions(membership.user.id, db, room_id=membership.room_id)

@router.get("/consensus")
async def get_consensus(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Phase 2: Detect multi-supported consensus and synthesize via LLM."""
    return await reasoning_engine.generate_consensus(membership.user.id, db, room_id=membership.room_id)

@router.get("/hypotheses")
async def get_hypotheses(
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Phase 2: Generate cross-domain hypotheses via LLM."""
    return await reasoning_engine.generate_hypothesis(membership.user.id, db, room_id=membership.room_id)
