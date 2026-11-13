from app.neo4j_driver import get_neo4j_driver
from app.services.entity_service import _parse_entity
from app.services.relationship_service import _parse_rel_record

def get_shortest_path(room_id: int, source_id: str, target_id: str, max_depth: int = 5):
    """Find the shortest path between two entities."""
    driver = get_neo4j_driver()
    query = f"""
    MATCH (start:Entity {{id: $source_id, room_id: $room_id}}), (end:Entity {{id: $target_id, room_id: $room_id}})
    MATCH p = shortestPath((start)-[*..{max_depth}]-(end))
    RETURN nodes(p) AS path_nodes, relationships(p) AS path_rels
    """
    
    with driver.session() as session:
        result = session.run(query, source_id=source_id, target_id=target_id, room_id=room_id)
        record = result.single()
        if not record:
            return {"nodes": [], "edges": []}
            
        nodes = [_parse_entity(n) for n in record["path_nodes"]]
        # relationships returns standard Relationship objects
        edges = []
        for r in record["path_rels"]:
            edges.append({
                "id": r.element_id,  # or proper ID if available
                "type": r.type,
                "source_id": r.nodes[0].get("id"),
                "target_id": r.nodes[1].get("id"),
                "description": r.get("description", "")
            })
            
    return {"nodes": nodes, "edges": edges}


def get_neighbors(room_id: int, entity_id: str, depth: int = 1):
    """Get N-hop neighbors of an entity."""
    driver = get_neo4j_driver()
    query = f"""
    MATCH (start:Entity {{id: $entity_id, room_id: $room_id}})-[r*1..{depth}]-(neighbor:Entity {{room_id: $room_id}})
    RETURN DISTINCT neighbor
    """
    
    with driver.session() as session:
        result = session.run(query, entity_id=entity_id, room_id=room_id)
        nodes = [_parse_entity(rec["neighbor"]) for rec in result]
        
    return nodes

def get_community_detection(room_id: int):
    """Detect communities using a simple algorithmic approach (e.g., node grouping by label)."""
    # Since GDS plugin may not be installed, we simulate community detection
    # by grouping entities by their connected components or simply by type for V0.2
    driver = get_neo4j_driver()
    query = """
    MATCH (n:Entity {room_id: $room_id})
    RETURN n.type AS community, count(n) AS size, collect(n.name)[0..5] AS top_members
    ORDER BY size DESC
    """
    
    communities = []
    with driver.session() as session:
        result = session.run(query, room_id=room_id)
        for rec in result:
            communities.append({
                "community_name": rec["community"],
                "size": rec["size"],
                "top_members": rec["top_members"]
            })
            
    return communities
