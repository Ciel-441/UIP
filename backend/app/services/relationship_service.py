"""Relationship service – CRUD operations on Neo4j relationship edges."""

import uuid
from datetime import datetime

from app.neo4j_driver import get_neo4j_driver
from app.utils.sanitization import sanitize_text


# Map lowercase API relationship types to uppercase Neo4j relationship types
REL_TYPE_MAP = {
    "affects": "AFFECTS",
    "causes": "CAUSES",
    "treated_by": "TREATED_BY",
    "related_to": "RELATED_TO",
    "depends_on": "DEPENDS_ON",
    "found_in": "FOUND_IN",
    "cites": "CITES",
    "authored": "AUTHORED",
    "published": "PUBLISHED",
    "supports": "SUPPORTS",
    "contradicts": "CONTRADICTS",
    "influences_positively": "INFLUENCES_POSITIVELY",
    "influences_negatively": "INFLUENCES_NEGATIVELY",
    "mitigates": "MITIGATES",
}


def _parse_rel_record(record) -> dict:
    """Parse a neo4j relationship query record into a dict."""
    return {
        "id": record.get("id", ""),
        "type": record.get("type", ""),
        "source_id": record.get("source_id", ""),
        "target_id": record.get("target_id", ""),
        "source_name": record.get("source_name", ""),
        "target_name": record.get("target_name", ""),
        "description": record.get("description", ""),
        "created_at": record.get("created_at", ""),
        "confidence_score": record.get("confidence_score", 1.0),
        "source_evidence": record.get("source_evidence", []),
        "modification_history": record.get("modification_history", "[]"),
        "valid_from": record.get("valid_from", ""),
        "valid_to": record.get("valid_to", None),
    }


def create_relationship(
    room_id: int,
    type: str, 
    source_id: str, 
    target_id: str, 
    description: str = "",
    confidence_score: float = 1.0,
    source_evidence: list = None
) -> dict:
    """Create a relationship between two Entity nodes in Neo4j."""
    driver = get_neo4j_driver()
    rel_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    type_lower = type.lower().strip()
    description = sanitize_text(description, 500)
    source_ev_list = source_evidence or []
    
    import json

    mod_history_json = json.dumps([{"action": "created", "timestamp": created_at}])

    from app.utils.sanitization import sanitize_label
    neo4j_type = REL_TYPE_MAP.get(type_lower)
    if not neo4j_type:
        # Allow dynamic types, sanitize and uppercase
        neo4j_type = sanitize_label(type, "RELATED_TO").upper()
        type_lower = neo4j_type.lower()

    # Build cypher with the relationship type as a label (safe since validated via map)
    query = f"""
    MATCH (s:Entity {{id: $source_id, room_id: $room_id}}), (t:Entity {{id: $target_id, room_id: $room_id}})
    CREATE (s)-[r:{neo4j_type} {{
        id: $id,
        type: $type,
        description: $description,
        created_at: $created_at,
        confidence_score: $confidence_score,
        source_evidence: $source_evidence,
        modification_history: $modification_history,
        valid_from: $created_at,
        valid_to: null
    }}]->(t)
    RETURN r.id AS id, r.type AS type, s.id AS source_id, t.id AS target_id,
           s.name AS source_name, t.name AS target_name,
           r.description AS description, r.created_at AS created_at,
           r.confidence_score AS confidence_score, r.source_evidence AS source_evidence,
           r.modification_history AS modification_history, r.valid_from AS valid_from,
           r.valid_to AS valid_to
    """

    with driver.session() as session:
        result = session.run(
            query,
            id=rel_id,
            type=type_lower,
            source_id=source_id,
            target_id=target_id,
            description=description,
            created_at=created_at,
            confidence_score=confidence_score,
            source_evidence=source_ev_list,
            modification_history=mod_history_json,
            room_id=room_id,
        )
        record = result.single()
        
        # If the relationship is CITES, increment the citation_count of the target entity
        if type_lower == "cites":
            session.run("MATCH (e:Entity {id: $id, room_id: $room_id}) SET e.citation_count = coalesce(e.citation_count, 0) + 1", id=target_id, room_id=room_id)
            
        if record:
            return _parse_rel_record(record)
    return {}


def get_relationship(room_id: int, rel_id: str) -> dict | None:
    """Find a relationship by its id property."""
    driver = get_neo4j_driver()

    query = """
    MATCH (s:Entity {room_id: $room_id})-[r]->(t:Entity {room_id: $room_id})
    WHERE r.id = $rel_id
    RETURN r.id AS id, r.type AS type, s.id AS source_id, t.id AS target_id,
           s.name AS source_name, t.name AS target_name,
           r.description AS description, r.created_at AS created_at
    """

    with driver.session() as session:
        result = session.run(query, rel_id=rel_id, room_id=room_id)
        record = result.single()
        if record:
            return _parse_rel_record(record)
    return None


def delete_relationship(room_id: int, rel_id: str) -> bool:
    """Delete a relationship by its id property."""
    driver = get_neo4j_driver()

    with driver.session() as session:
        # Check if exists
        check = session.run(
            "MATCH (s:Entity {room_id: $room_id})-[r]->(t:Entity {room_id: $room_id}) WHERE r.id = $rel_id RETURN r.id AS id",
            rel_id=rel_id, room_id=room_id,
        ).single()
        if not check:
            return False

        session.run(
            "MATCH (s:Entity {room_id: $room_id})-[r]->(t:Entity {room_id: $room_id}) WHERE r.id = $rel_id DELETE r",
            rel_id=rel_id, room_id=room_id,
        )
        return True


def list_relationships(
    room_id: int,
    source_id: str = None,
    target_id: str = None,
    type_filter: str = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple:
    """List relationships with optional filters. Returns (items, total)."""
    driver = get_neo4j_driver()

    where_clauses = []
    params = {"room_id": room_id}

    if source_id:
        where_clauses.append("s.id = $source_id")
        params["source_id"] = source_id
    if target_id:
        where_clauses.append("t.id = $target_id")
        params["target_id"] = target_id
    if type_filter:
        where_clauses.append("r.type = $type_filter")
        params["type_filter"] = type_filter.lower()

    where_str = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    with driver.session() as session:
        # Count
        count_query = f"""
        MATCH (s:Entity {{room_id: $room_id}})-[r]->(t:Entity {{room_id: $room_id}}){where_str}
        RETURN count(r) AS total
        """
        total = session.run(count_query, **params).single()["total"]

        # Items
        query = f"""
        MATCH (s:Entity {{room_id: $room_id}})-[r]->(t:Entity {{room_id: $room_id}}){where_str}
        RETURN r.id AS id, r.type AS type, s.id AS source_id, t.id AS target_id,
               s.name AS source_name, t.name AS target_name,
               r.description AS description, r.created_at AS created_at,
               r.confidence_score AS confidence_score, r.source_evidence AS source_evidence,
               r.modification_history AS modification_history
        ORDER BY r.created_at DESC
        SKIP $offset LIMIT $limit
        """
        params["offset"] = offset
        params["limit"] = limit

        result = session.run(query, **params)
        items = [_parse_rel_record(record) for record in result]

    return items, total
