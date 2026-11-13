"""Entity service – CRUD operations on Neo4j Entity nodes."""

import json
import uuid
import re
from datetime import datetime
from typing import Optional

from app.neo4j_driver import get_neo4j_driver
from app.utils.sanitization import sanitize_text, sanitize_label



def _parse_entity(record) -> dict:
    """Convert a neo4j record (with key 'e') to a dict."""
    if hasattr(record, "keys") and "e" in record.keys():
        node = record["e"]
    else:
        node = record
    props = dict(node) if hasattr(node, "items") else node
    # Parse properties JSON string back to dict
    raw_props = props.get("properties", "{}")
    if isinstance(raw_props, str):
        try:
            parsed_props = json.loads(raw_props)
        except (json.JSONDecodeError, TypeError):
            parsed_props = {}
    else:
        parsed_props = raw_props if raw_props else {}

    # Parse history lists (JSON strings) back to dict lists
    mod_history = props.get("modification_history", "[]")
    if isinstance(mod_history, str):
        try:
            mod_history = json.loads(mod_history)
        except (json.JSONDecodeError, TypeError):
            mod_history = []

    val_history = props.get("validation_history", "[]")
    if isinstance(val_history, str):
        try:
            val_history = json.loads(val_history)
        except (json.JSONDecodeError, TypeError):
            val_history = []

    return {
        "id": props.get("id", ""),
        "name": props.get("name", ""),
        "type": props.get("type", ""),
        "description": props.get("description", ""),
        "properties": parsed_props,
        "created_at": props.get("created_at", ""),
        "source_document_id": props.get("source_document_id"),
        "confidence_score": props.get("confidence_score", 1.0),
        "citation_count": props.get("citation_count", 0),
        "source_evidence": props.get("source_evidence", []),
        "aliases": props.get("aliases", []),
        "modification_history": mod_history,
        "validation_history": val_history,
        "valid_from": props.get("valid_from", ""),
        "valid_to": props.get("valid_to", None),
    }


def create_entity(
    room_id: int,
    name: str,
    type: str,
    description: str = "",
    properties: dict = None,
    source_document_id: str = None,
    confidence_score: float = 1.0,
    source_evidence: list = None,
    aliases: list = None,
) -> dict:
    """Create a new Entity node in Neo4j with both :Entity and :<type> labels."""
    driver = get_neo4j_driver()
    entity_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    # Sanitize inputs to prevent Cypher / script injection & prompt injection
    name = sanitize_text(name, 100)
    description = sanitize_text(description, 500)
    type_label = sanitize_label(type, "Concept")

    # Sanitize properties dictionary
    sanitized_properties = {"confidence_score": 1.0}
    if isinstance(properties, dict):
        for k, v in properties.items():
            clean_k = re.sub(r'[^a-zA-Z0-9_]', '', str(k))[:50]
            if clean_k:
                if isinstance(v, (int, float)):
                    sanitized_properties[clean_k] = v
                elif isinstance(v, bool):
                    sanitized_properties[clean_k] = v
                else:
                    sanitized_properties[clean_k] = sanitize_text(str(v), 200)

    props_json = json.dumps(sanitized_properties)
    source_ev_list = source_evidence or []
    aliases_list = [sanitize_text(a, 100) for a in (aliases or [])]
    mod_history_json = json.dumps([{"action": "created", "timestamp": created_at}])
    val_history_json = json.dumps([])


    query = f"""
    CREATE (e:Entity:{type_label} {{
        id: $id,
        room_id: $room_id,
        name: $name,
        type: $type,
        description: $description,
        properties: $properties,
        created_at: $created_at,
        source_document_id: $source_document_id,
        confidence_score: $confidence_score,
        citation_count: $citation_count,
        source_evidence: $source_evidence,
        aliases: $aliases,
        modification_history: $modification_history,
        validation_history: $validation_history,
        valid_from: $created_at,
        valid_to: null
    }})
    RETURN e
    """

    with driver.session() as session:
        result = session.run(
            query,
            id=entity_id,
            room_id=room_id,
            name=name,
            type=type,
            description=description,
            properties=props_json,
            created_at=created_at,
            source_document_id=source_document_id,
            confidence_score=confidence_score,
            citation_count=0,
            source_evidence=source_ev_list,
            aliases=aliases_list,
            modification_history=mod_history_json,
            validation_history=val_history_json,
        )
        record = result.single()
        if record:
            return _parse_entity(record)
    return {}


def get_entity(room_id: int, entity_id: str) -> dict | None:
    """Get a single entity by ID."""
    driver = get_neo4j_driver()
    query = "MATCH (e:Entity {id: $id, room_id: $room_id}) RETURN e"

    with driver.session() as session:
        result = session.run(query, id=entity_id, room_id=room_id)
        record = result.single()
        if record:
            return _parse_entity(record)
    return None


def get_entity_connections(room_id: int, entity_id: str, as_of_date: str = None) -> dict:
    """Get incoming and outgoing relationships for an entity, optionally filtered by a date."""
    driver = get_neo4j_driver()

    incoming = []
    outgoing = []

    with driver.session() as session:
        date_filter_query = ""
        if as_of_date:
            date_filter_query = "AND (r.valid_from IS NULL OR r.valid_from <= $as_of_date) AND (r.valid_to IS NULL OR r.valid_to > $as_of_date)"

        # Outgoing relationships
        out_result = session.run(
            f"""
            MATCH (s:Entity {{id: $id, room_id: $room_id}})-[r]->(t:Entity {{room_id: $room_id}})
            WHERE 1=1 {date_filter_query}
            RETURN r.id AS id, r.type AS type, s.id AS source_id, t.id AS target_id,
                   s.name AS source_name, t.name AS target_name,
                   r.description AS description, r.created_at AS created_at
            """,
            id=entity_id,
            room_id=room_id,
            as_of_date=as_of_date
        )
        for record in out_result:
            outgoing.append({
                "id": record["id"] or "",
                "type": record["type"] or "",
                "source_id": record["source_id"] or "",
                "target_id": record["target_id"] or "",
                "source_name": record["source_name"] or "",
                "target_name": record["target_name"] or "",
                "description": record["description"] or "",
                "created_at": record["created_at"] or "",
            })

        # Incoming relationships
        in_result = session.run(
            f"""
            MATCH (s:Entity {{room_id: $room_id}})-[r]->(t:Entity {{id: $id, room_id: $room_id}})
            WHERE 1=1 {date_filter_query}
            RETURN r.id AS id, r.type AS type, s.id AS source_id, t.id AS target_id,
                   s.name AS source_name, t.name AS target_name,
                   r.description AS description, r.created_at AS created_at
            """,
            id=entity_id,
            room_id=room_id,
            as_of_date=as_of_date
        )
        for record in in_result:
            incoming.append({
                "id": record["id"] or "",
                "type": record["type"] or "",
                "source_id": record["source_id"] or "",
                "target_id": record["target_id"] or "",
                "source_name": record["source_name"] or "",
                "target_name": record["target_name"] or "",
                "description": record["description"] or "",
                "created_at": record["created_at"] or "",
            })

    return {"incoming": incoming, "outgoing": outgoing}


def update_entity(room_id: int, entity_id: str, updates: dict) -> dict | None:
    """Update properties on an existing Entity node."""
    driver = get_neo4j_driver()

    # Build SET clauses dynamically
    set_clauses = []
    params = {"id": entity_id, "room_id": room_id}

    if "name" in updates and updates["name"] is not None:
        clean_name = sanitize_text(updates["name"], 100)
        set_clauses.append("e.name = $name")
        params["name"] = clean_name
    if "description" in updates and updates["description"] is not None:
        clean_desc = sanitize_text(updates["description"], 500)
        set_clauses.append("e.description = $description")
        params["description"] = clean_desc
    if "properties" in updates and updates["properties"] is not None:
        sanitized_properties = {}
        if isinstance(updates["properties"], dict):
            for k, v in updates["properties"].items():
                clean_k = re.sub(r'[^a-zA-Z0-9_]', '', str(k))[:50]
                if clean_k:
                    if isinstance(v, (int, float, bool)):
                        sanitized_properties[clean_k] = v
                    else:
                        sanitized_properties[clean_k] = sanitize_text(str(v), 200)
        set_clauses.append("e.properties = $properties")
        params["properties"] = json.dumps(sanitized_properties)
    if "type" in updates and updates["type"] is not None:
        clean_type = sanitize_label(updates["type"], "Concept")
        set_clauses.append("e.type = $new_type")
        params["new_type"] = clean_type
    if "confidence_score" in updates:
        set_clauses.append("e.confidence_score = $confidence_score")
        params["confidence_score"] = updates["confidence_score"]
    if "source_evidence" in updates:
        set_clauses.append("e.source_evidence = $source_evidence")
        params["source_evidence"] = updates["source_evidence"]
    if "aliases" in updates:
        clean_aliases = [sanitize_text(a, 100) for a in (updates["aliases"] or [])]
        set_clauses.append("e.aliases = $aliases")
        params["aliases"] = clean_aliases


    if not set_clauses:
        return get_entity(room_id, entity_id)

    # Fetch current entity to append to modification history
    current_entity = get_entity(room_id, entity_id)
    if current_entity:
        mod_history = current_entity.get("modification_history", [])
        if not isinstance(mod_history, list):
            mod_history = []
        mod_history.append({"action": "updated", "timestamp": datetime.utcnow().isoformat(), "fields": list(updates.keys())})
        set_clauses.append("e.modification_history = $modification_history")
        params["modification_history"] = json.dumps(mod_history)

    set_clause = ", ".join(set_clauses)

    with driver.session() as session:
        # If type is changing, remove old label and add new one
        if "type" in updates and updates["type"] is not None:
            new_type_label = sanitize_label(updates["type"], "Concept")
            if current_entity and current_entity.get("type"):
                old_label = sanitize_label(current_entity["type"], "Concept")
                # Remove old label and add new one
                session.run(
                    f"MATCH (e:Entity {{id: $id, room_id: $room_id}}) REMOVE e:{old_label} SET e:{new_type_label}",
                    id=entity_id,
                    room_id=room_id,
                )


        query = f"MATCH (e:Entity {{id: $id, room_id: $room_id}}) SET {set_clause} RETURN e"
        result = session.run(query, **params)
        record = result.single()
        if record:
            return _parse_entity(record)
    return None


def delete_entity(room_id: int, entity_id: str) -> bool:
    """Delete an entity and all its relationships."""
    driver = get_neo4j_driver()

    with driver.session() as session:
        # Check if entity exists first
        check = session.run(
            "MATCH (e:Entity {id: $id, room_id: $room_id}) RETURN e.id AS id", id=entity_id, room_id=room_id
        ).single()
        if not check:
            return False

        session.run("MATCH (e:Entity {id: $id, room_id: $room_id}) DETACH DELETE e", id=entity_id, room_id=room_id)
        return True


def list_entities(
    room_id: int,
    type_filter: str = None,
    search: str = None,
    limit: int = 20,
    offset: int = 0,
    as_of_date: str = None,
) -> tuple:
    """List entities with optional type, search, and as_of_date filters. Returns (items, total)."""
    driver = get_neo4j_driver()

    where_clauses = ["e.room_id = $room_id"]
    params = {"room_id": room_id}

    if type_filter:
        where_clauses.append("e.type = $type_filter")
        params["type_filter"] = type_filter
    if search:
        where_clauses.append(
            "(toLower(e.name) CONTAINS toLower($search) OR toLower(e.description) CONTAINS toLower($search))"
        )
        params["search"] = search
        
    if as_of_date:
        where_clauses.append("(e.valid_from IS NULL OR e.valid_from <= $as_of_date) AND (e.valid_to IS NULL OR e.valid_to > $as_of_date)")
        params["as_of_date"] = as_of_date

    where_str = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    with driver.session() as session:
        # Get total count
        count_query = f"MATCH (e:Entity){where_str} RETURN count(e) AS total"
        count_result = session.run(count_query, **params)
        total = count_result.single()["total"]

        # Get paginated items
        query = f"""
        MATCH (e:Entity){where_str}
        RETURN e
        ORDER BY e.created_at DESC
        SKIP $offset LIMIT $limit
        """
        params["offset"] = offset
        params["limit"] = limit

        result = session.run(query, **params)
        items = [_parse_entity(record) for record in result]

    return items, total


def get_entity_by_name(room_id: int, name: str) -> dict | None:
    """Find an entity by case-insensitive name match."""
    driver = get_neo4j_driver()

    with driver.session() as session:
        result = session.run(
            "MATCH (e:Entity {room_id: $room_id}) WHERE toLower(e.name) = toLower($name) RETURN e LIMIT 1", name=name, room_id=room_id
        )
        record = result.single()
        if record:
            return _parse_entity(record)
    return None
