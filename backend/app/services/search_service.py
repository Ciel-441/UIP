"""Search service – full-text search across entities, relationships, and documents."""

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.document import Document
from app.neo4j_driver import get_neo4j_driver


def search_entities(room_id: int, query: str, limit: int = 20) -> list:
    """Search Neo4j entities by name or description (case-insensitive)."""
    driver = get_neo4j_driver()
    results = []

    if not driver:
        return results

    with driver.session() as session:
        result = session.run(
            """
            MATCH (e:Entity {room_id: $room_id})
            WHERE (toLower(e.name) CONTAINS toLower($search_term)
               OR toLower(e.description) CONTAINS toLower($search_term))
            RETURN e.id AS id, e.name AS name, e.type AS type,
                   e.description AS description
            LIMIT $limit
            """,
            search_term=query,
            limit=limit,
            room_id=room_id,
        )
        for record in result:
            name = record["name"] or ""
            query_lower = query.lower()
            # Relevance scoring
            if name.lower() == query_lower:
                relevance = 1.0
            elif query_lower in name.lower():
                relevance = 0.8
            else:
                relevance = 0.6

            results.append({
                "id": record["id"],
                "type": "entity",
                "name": name,
                "description": record["description"] or "",
                "relevance": relevance,
                "related_entities": None,
                "source_document": None,
            })

    # Sort by relevance
    results.sort(key=lambda x: x["relevance"], reverse=True)
    return results


def search_relationships(room_id: int, query: str, limit: int = 20) -> list:
    """Search Neo4j relationships by description or connected entity names."""
    driver = get_neo4j_driver()
    results = []

    if not driver:
        return results

    with driver.session() as session:
        result = session.run(
            """
            MATCH (s:Entity {room_id: $room_id})-[r]->(t:Entity {room_id: $room_id})
            WHERE (toLower(r.description) CONTAINS toLower($search_term)
               OR toLower(s.name) CONTAINS toLower($search_term)
               OR toLower(t.name) CONTAINS toLower($search_term)
               OR toLower(r.type) CONTAINS toLower($search_term))
            RETURN r.id AS id, r.type AS type, r.description AS description,
                   s.name AS source_name, t.name AS target_name,
                   s.id AS source_id, t.id AS target_id
            LIMIT $limit
            """,
            search_term=query,
            limit=limit,
            room_id=room_id,
        )
        for record in result:
            rel_type = record["type"] or ""
            name = f"{record['source_name']} → {record['target_name']}"
            description = record["description"] or f"{rel_type} relationship"

            results.append({
                "id": record["id"],
                "type": "relationship",
                "name": name,
                "description": description,
                "relevance": 0.7,
                "related_entities": [record["source_id"], record["target_id"]],
                "source_document": None,
            })

    return results


async def search_documents(room_id: int, query: str, db: AsyncSession, limit: int = 20) -> list:
    """Search PostgreSQL documents by filename or content text."""
    results = []
    search_pattern = f"%{query}%"

    stmt = (
        select(Document)
        .where(Document.room_id == room_id)
        .where(
            or_(
                Document.original_name.ilike(search_pattern),
                Document.content_text.ilike(search_pattern),
            )
        )
        .limit(limit)
    )
    db_result = await db.execute(stmt)
    documents = db_result.scalars().all()

    for doc in documents:
        query_lower = query.lower()
        name = doc.original_name or doc.filename
        if query_lower in (doc.original_name or "").lower():
            relevance = 0.8
        else:
            relevance = 0.6

        results.append({
            "id": str(doc.id),
            "type": "document",
            "name": name,
            "description": (doc.content_text or "")[:200],
            "relevance": relevance,
            "related_entities": None,
            "source_document": doc.filename,
        })

    return results


async def search_all(room_id: int, query: str, type_filter: str, db: AsyncSession) -> list:
    """Combine search results from entities, relationships, and documents."""
    results = []

    if type_filter in ("all", "entity", "entities"):
        results.extend(search_entities(room_id, query))
    if type_filter in ("all", "relationship", "relationships"):
        results.extend(search_relationships(room_id, query))
    if type_filter in ("all", "document", "documents"):
        doc_results = await search_documents(room_id, query, db)
        results.extend(doc_results)

    # Sort by relevance
    results.sort(key=lambda x: x["relevance"], reverse=True)
    return results
