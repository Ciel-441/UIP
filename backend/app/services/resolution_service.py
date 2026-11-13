import difflib
import json
from datetime import datetime

from app.neo4j_driver import get_neo4j_driver
from app.services.entity_service import get_entity, update_entity, delete_entity, _parse_entity
from app.services.relationship_service import _parse_rel_record

def similarity_score(a: str, b: str) -> float:
    """Calculate similarity score between two strings (0.0 to 1.0)."""
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


def find_duplicate_entities(room_id: int, similarity_threshold: float = 0.8) -> list:
    """Find and return suggested duplicate entities based on name similarity."""
    driver = get_neo4j_driver()
    query = """
    MATCH (e:Entity {room_id: $room_id})
    RETURN e
    """
    
    with driver.session() as session:
        result = session.run(query, room_id=room_id)
        entities = [_parse_entity(record) for record in result]
        
    suggestions = []
    # O(N^2) comparison - fine for small graphs, but would need optimization (e.g. TF-IDF/embeddings) for large ones
    for i in range(len(entities)):
        for j in range(i + 1, len(entities)):
            e1 = entities[i]
            e2 = entities[j]
            # Only compare entities of the same type
            if e1.get("type") == e2.get("type"):
                score = similarity_score(e1.get("name", ""), e2.get("name", ""))
                if score >= similarity_threshold:
                    suggestions.append({
                        "entity1": e1,
                        "entity2": e2,
                        "similarity_score": score
                    })
                    
    # Sort suggestions by highest similarity score
    suggestions.sort(key=lambda x: x["similarity_score"], reverse=True)
    return suggestions


def merge_entities(room_id: int, target_id: str, source_id: str) -> dict:
    """
    Merge source_id into target_id.
    - Aliases: add source name and aliases to target aliases.
    - Relationships: re-wire all source relationships to target.
    - Confidence: aggregate/recalculate confidence.
    - Delete source_id.
    """
    driver = get_neo4j_driver()
    
    target = get_entity(room_id, target_id)
    source = get_entity(room_id, source_id)
    
    if not target or not source:
        raise ValueError("Target or Source entity not found")
        
    # Aggregate aliases
    target_aliases = set(target.get("aliases", []))
    source_aliases = set(source.get("aliases", []))
    target_aliases.add(source.get("name"))
    target_aliases.update(source_aliases)
    # Remove target name if it accidentally got into aliases
    if target.get("name") in target_aliases:
        target_aliases.remove(target.get("name"))
        
    # Aggregate evidence
    target_evidence = set(target.get("source_evidence", []))
    source_evidence = set(source.get("source_evidence", []))
    target_evidence.update(source_evidence)
    
    # Recalculate confidence (e.g., take the max, or average, or boost)
    new_confidence = min(1.0, max(target.get("confidence_score", 1.0), source.get("confidence_score", 1.0)) + 0.1)

    # 1. Rewire relationships in Neo4j
    # We use Cypher to move incoming and outgoing relationships
    rewire_query = """
    MATCH (s:Entity {id: $source_id})
    MATCH (t:Entity {id: $target_id})
    
    // Rewire outgoing
    OPTIONAL MATCH (s)-[out_r]->(other)
    CALL apoc.refactor.toNode(out_r, t) YIELD input AS moved_out, output AS new_out_r
    
    // Rewire incoming
    OPTIONAL MATCH (other_in)-[in_r]->(s)
    CALL apoc.refactor.toNode(in_r, t) YIELD input AS moved_in, output AS new_in_r
    
    RETURN count(moved_out) + count(moved_in) as rewired_count
    """
    
    with driver.session() as session:
        # Since APOC might not be available, let's do it manually just in case
        manual_rewire = """
        MATCH (s:Entity {id: $source_id})
        MATCH (t:Entity {id: $target_id})
        
        // Clone outgoing
        OPTIONAL MATCH (s)-[out_r]->(out_node)
        FOREACH (ignore IN CASE WHEN out_r IS NOT NULL THEN [1] ELSE [] END |
            CREATE (t)-[new_out:REL_TYPE_PLACEHOLDER]->(out_node)
            SET new_out = out_r
        )
        
        // Clone incoming
        WITH s, t
        OPTIONAL MATCH (in_node)-[in_r]->(s)
        FOREACH (ignore IN CASE WHEN in_r IS NOT NULL THEN [1] ELSE [] END |
            CREATE (in_node)-[new_in:REL_TYPE_PLACEHOLDER]->(t)
            SET new_in = in_r
        )
        """
        # Since APOC refactor is best but we can't guarantee it, we will just run a python loop
        
        # Get all source relationships
        out_result = session.run("MATCH (s:Entity {id: $id, room_id: $room_id})-[r]->(t:Entity {room_id: $room_id}) RETURN r, type(r) as r_type, t.id as t_id", id=source_id, room_id=room_id)
        out_rels = [(rec["r"], rec["r_type"], rec["t_id"]) for rec in out_result]
        
        in_result = session.run("MATCH (s:Entity {room_id: $room_id})-[r]->(t:Entity {id: $id, room_id: $room_id}) RETURN r, type(r) as r_type, s.id as s_id", id=source_id, room_id=room_id)
        in_rels = [(rec["r"], rec["r_type"], rec["s_id"]) for rec in in_result]
        
        # Create new relationships on target
        for r, r_type, t_id in out_rels:
            props = dict(r)
            props_str = "{" + ", ".join([f"{k}: ${k}" for k in props.keys()]) + "}"
            query = f"MATCH (s:Entity {{id: $source_id}}), (t:Entity {{id: $t_id}}) CREATE (s)-[new_r:{r_type} {props_str}]->(t)"
            props["source_id"] = target_id
            props["t_id"] = t_id
            props["room_id"] = room_id
            session.run(query, **props)
            
        for r, r_type, s_id in in_rels:
            props = dict(r)
            props_str = "{" + ", ".join([f"{k}: ${k}" for k in props.keys()]) + "}"
            query = f"MATCH (s:Entity {{id: $s_id}}), (t:Entity {{id: $target_id}}) CREATE (s)-[new_r:{r_type} {props_str}]->(t)"
            props["s_id"] = s_id
            props["target_id"] = target_id
            props["room_id"] = room_id
            session.run(query, **props)
            
        # Delete old relationships connected to source_id
        session.run("MATCH (s:Entity {id: $id, room_id: $room_id})-[r]-() DELETE r", id=source_id, room_id=room_id)
        
        # Delete source node
        session.run("MATCH (s:Entity {id: $id, room_id: $room_id}) DELETE s", id=source_id, room_id=room_id)

    # 2. Update target entity properties
    updated_target = update_entity(room_id, target_id, {
        "aliases": list(target_aliases),
        "source_evidence": list(target_evidence),
        "confidence_score": new_confidence
    })
    
    return updated_target
