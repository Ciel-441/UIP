import asyncio
import logging
from app.neo4j_driver import get_neo4j_driver
from app.services.ai_service import ask_ollama_json
from app.database import async_session_maker
from sqlalchemy import select
from app.models.multi_tenant import DataRoom
from app.models.intelligence import Hypothesis
from app.routers.communication import manager
import json

logger = logging.getLogger(__name__)

async def continuous_discovery_heartbeat():
    """
    Background worker that acts as the heartbeat for the Autonomous Intelligence Platform.
    Wakes up periodically to scan the graph, generate hypotheses, and trigger autonomous workflows per room.
    """
    logger.info("Continuous Discovery Engine initialized.")
    while True:
        try:
            # Wake up every 60 seconds
            await asyncio.sleep(60)
            logger.info("Discovery heartbeat running autonomous scan...")
            
            driver = get_neo4j_driver()
            if not driver:
                continue

            async with async_session_maker() as db:
                result = await db.execute(select(DataRoom).where(DataRoom.is_active == True))
                rooms = result.scalars().all()
                
                for room in rooms:
                    room_id = room.id
                    
                    # Run auto-linking for orphans in the background
                    try:
                        await auto_link_orphans(room_id, driver)
                    except Exception as e:
                        logger.error(f"Error auto-linking orphans in room {room_id}: {e}")
                    
                    # 1. Connect to Neo4j and find random interesting edges for this room
                    graph_data = []
                    with driver.session() as session:
                        # Get 5 random relationships to look for emerging consensus or contradictions
                        res = session.run(
                            """
                            MATCH (source:Entity {room_id: $room_id})-[r]->(target:Entity {room_id: $room_id})
                            WITH source, r, target, rand() AS random
                            ORDER BY random
                            LIMIT 5
                            RETURN source.name AS source_name, type(r) AS rel_type, target.name AS target_name
                            """, room_id=room_id
                        )
                        for record in res:
                            graph_data.append(f"{record['source_name']} {record['rel_type']} {record['target_name']}")

                    if not graph_data:
                        continue

                    # 2. Feed to Ollama to synthesize a hypothesis
                    system_prompt = "You are an autonomous discovery engine. Analyze the provided knowledge graph relationships and generate an interesting hypothesis or spot a contradiction. Calculate a confidence score based on the strength of the relationships. Return a strict JSON object with 'title' (string), 'description' (string), 'status' (one of: supported, contradicted, emerging), and 'confidence' (float 0.0 to 1.0)."
                    user_prompt = f"Graph Relationships: {json.dumps(graph_data)}\n\nGenerate JSON matching {{ 'title': '...', 'description': '...', 'status': 'emerging', 'confidence': <calculate_float_here> }}"
                    
                    discovery = await ask_ollama_json(system_prompt, user_prompt)
                    
                    if not discovery or 'title' not in discovery:
                        continue

                    # 3. Store in Postgres
                    hypothesis = Hypothesis(
                        title=discovery.get("title", "Autonomous Discovery"),
                        description=discovery.get("description", "Analyzed recent graph connections."),
                        status=discovery.get("status", "emerging"),
                        confidence=float(discovery.get("confidence", 0.5)),
                        evidence=[{"type": "graph", "data": d} for d in graph_data],
                        room_id=room_id
                    )
                    db.add(hypothesis)
                    await db.commit()
                    await db.refresh(hypothesis)
                    
                    # 4. Broadcast to WebSockets
                    await manager.broadcast_global({
                        "type": "discovery_update",
                        "hypothesis_id": hypothesis.id,
                        "title": hypothesis.title,
                        "status": hypothesis.status,
                        "confidence": hypothesis.confidence
                    })
                    
                    logger.info(f"Discovery heartbeat generated new hypothesis for room {room_id}: {discovery.get('title')}")
            
        except asyncio.CancelledError:
            logger.info("Continuous Discovery Engine stopped.")
            break
        except Exception as e:
            logger.error(f"Error in Continuous Discovery Engine: {e}")
            await asyncio.sleep(10)


async def auto_link_orphans(room_id: int, driver, user_id: int = None, db = None) -> int:
    """Scan the graph for orphan entities and automatically link them using Ollama reasoning."""
    from app.services.relationship_service import create_relationship
    from app.services.ai_service import get_user_settings, ask_ollama_json
    from app.database import async_session_maker
    
    # 1. Find orphan entities (degree = 0)
    orphans = []
    with driver.session() as session:
        res = session.run(
            """
            MATCH (e:Entity {room_id: $room_id})
            WHERE not (e)-[]-()
            RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description
            LIMIT 5
            """,
            room_id=room_id
        )
        for record in res:
            orphans.append({
                "id": record["id"],
                "name": record["name"],
                "type": record["type"],
                "description": record["description"] or ""
            })
            
    if not orphans:
        return 0
        
    logger.info(f"Auto-linking engine: found {len(orphans)} orphans in room {room_id}")
    
    # 2. Find candidate main nodes in the graph
    candidates = []
    with driver.session() as session:
        res = session.run(
            """
            MATCH (t:Entity {room_id: $room_id})-[r]-()
            WITH t, count(r) AS degree
            ORDER BY degree DESC
            LIMIT 10
            RETURN t.id AS id, t.name AS name, t.type AS type, t.description AS description
            """,
            room_id=room_id
        )
        for record in res:
            candidates.append({
                "id": record["id"],
                "name": record["name"],
                "type": record["type"],
                "description": record["description"] or ""
            })
            
    if not candidates:
        # Fallback to general nodes if graph has no connections yet
        with driver.session() as session:
            res = session.run(
                """
                MATCH (t:Entity {room_id: $room_id})
                LIMIT 10
                RETURN t.id AS id, t.name AS name, t.type AS type, t.description AS description
                """,
                room_id=room_id
            )
            for record in res:
                if record["id"] not in [o["id"] for o in orphans]:
                    candidates.append({
                        "id": record["id"],
                        "name": record["name"],
                        "type": record["type"],
                        "description": record["description"] or ""
                    })
                    
    if not candidates:
        return 0
        
    endpoint = None
    model = None
    if user_id is not None and db is not None:
        try:
            user_settings = await get_user_settings(user_id, db)
            endpoint = user_settings.get("endpoint")
            model = user_settings.get("model")
        except Exception:
            pass
            
    # 3. Ask Ollama to find connections
    created_count = 0
    for orphan in orphans:
        system_prompt = (
            "You are an autonomous relationship discovery engine. An orphan entity has no connections in the knowledge graph. "
            "Determine if there is a highly plausible logical relationship between the orphan entity and any of the candidate entities in the list. "
            "Focus only on strong, direct logical connections. E.g. crops relate to chemicals that fertilize them, agronomists relate to crop yields, etc. "
            "Return a strict JSON object with this format (no other text):\n"
            '{"links": [{"target_name": "Candidate Entity Name", "relationship_type": "related_to", "description": "Reason for connection"}]}'
        )
        
        candidates_str = json.dumps([{ "name": c["name"], "type": c["type"], "description": c["description"] } for c in candidates])
        user_prompt = (
            f"Orphan Entity:\n- Name: {orphan['name']}\n- Type: {orphan['type']}\n- Description: {orphan['description']}\n\n"
            f"Candidate Entities in Graph:\n{candidates_str}\n\n"
            "Return JSON matching:\n"
            '{"links": [{"target_name": "...", "relationship_type": "...", "description": "..."}]}'
        )
        
        try:
            if endpoint and model:
                result = await ask_ollama_json(system_prompt, user_prompt, user_id=user_id, db=db)
            else:
                result = await ask_ollama_json(system_prompt, user_prompt)
                
            links = result.get("links", []) if isinstance(result, dict) else []
            
            for link in links:
                target_name = link.get("target_name", "").strip()
                rel_type = link.get("relationship_type", "related_to").strip()
                rel_desc = link.get("description", "").strip()
                
                if not target_name:
                    continue
                    
                matched_candidate = None
                for c in candidates:
                    if c["name"].lower() == target_name.lower():
                        matched_candidate = c
                        break
                        
                if not matched_candidate:
                    with driver.session() as session:
                        found = session.run(
                            "MATCH (e:Entity {room_id: $room_id}) WHERE toLower(e.name) = toLower($name) RETURN e.id AS id, e.name AS name LIMIT 1",
                            room_id=room_id, name=target_name
                        ).single()
                        if found:
                            matched_candidate = {
                                "id": found["id"],
                                "name": found["name"]
                            }
                            
                if matched_candidate:
                    logger.info(f"Auto-linked orphan: {orphan['name']} -> {rel_type} -> {matched_candidate['name']}")
                    create_relationship(
                        room_id=room_id,
                        type=rel_type,
                        source_id=orphan["id"],
                        target_id=matched_candidate["id"],
                        description=rel_desc,
                        confidence_score=0.8,
                        source_evidence=["autonomous_discovery"]
                    )
                    created_count += 1
        except Exception as e:
            logger.error(f"Failed to auto-link orphan {orphan['name']}: {e}")
            
    return created_count
