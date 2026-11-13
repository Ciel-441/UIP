"""Reasoning Engine - Graph-RAG architecture for Contradictions, Consensus, and Hypotheses."""

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.neo4j_driver import get_neo4j_driver
from app.models.document import Document
from app.config import settings
import httpx

logger = logging.getLogger(__name__)

async def _call_llm(prompt: str, user_id: int, db: AsyncSession) -> str:
    """Helper to call Ollama."""
    from app.services.ai_service import get_user_settings
    user_settings = await get_user_settings(user_id, db)
    endpoint = user_settings["endpoint"]
    model = user_settings["model"]
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{endpoint}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "No response from AI model.")
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        return f"Error: {e}"


async def detect_contradictions(user_id: int, room_id: int, db: AsyncSession) -> dict:
    """
    Graph-RAG Contradiction Detection
    1. Find conflicting relationships in Neo4j
    2. Fetch source documents
    3. LLM Map-Reduce to synthesize findings
    """
    driver = get_neo4j_driver()
    if not driver:
        return {"status": "error", "message": "Graph DB unavailable"}

    candidates = []
    with driver.session() as session:
        # Find nodes that have both SUPPORTS and CONTRADICTS edges pointing to them
        query = """
        MATCH (p1:Entity {room_id: $room_id})-[r1:SUPPORTS]->(target:Entity {room_id: $room_id})
        MATCH (p2:Entity {room_id: $room_id})-[r2:CONTRADICTS]->(target)
        RETURN target.name AS topic, 
               p1.name AS supporter, r1.source_evidence AS sup_evidence,
               p2.name AS contradicter, r2.source_evidence AS con_evidence
        LIMIT 5
        """
        for record in session.run(query, room_id=room_id):
            candidates.append({
                "topic": record["topic"],
                "supporter": record["supporter"],
                "sup_doc_ids": record["sup_evidence"] or [],
                "contradicter": record["contradicter"],
                "con_doc_ids": record["con_evidence"] or []
            })

    if not candidates:
        return {"status": "success", "contradictions": [], "message": "No strict graph contradictions found."}

    # Document Retrieval & LLM Synthesis
    results = []
    for candidate in candidates:
        sup_texts = []
        for doc_id_str in candidate["sup_doc_ids"]:
            try:
                doc_id = int(doc_id_str)
                result = await db.execute(select(Document).where(Document.id == doc_id, Document.room_id == room_id)); doc = result.scalars().first()
                if doc: sup_texts.append(doc.content_text[:1000])
            except: pass
            
        con_texts = []
        for doc_id_str in candidate["con_doc_ids"]:
            try:
                doc_id = int(doc_id_str)
                result = await db.execute(select(Document).where(Document.id == doc_id, Document.room_id == room_id)); doc = result.scalars().first()
                if doc: con_texts.append(doc.content_text[:1000])
            except: pass

        prompt = f"""Analyze the following conflicting evidence regarding: {candidate['topic']}

Supporting Source ({candidate['supporter']}):
{' '.join(sup_texts)}

Contradicting Source ({candidate['contradicter']}):
{' '.join(con_texts)}

Synthesize this contradiction. What is the core disagreement? Is one source more credible? Provide a concise summary of the contradiction."""

        synthesis = await _call_llm(prompt, user_id, db)
        results.append({
            "topic": candidate['topic'],
            "supporter": candidate['supporter'],
            "contradicter": candidate['contradicter'],
            "synthesis": synthesis
        })

    return {"status": "success", "contradictions": results}


async def generate_consensus(user_id: int, room_id: int, db: AsyncSession) -> dict:
    """
    Graph-RAG Consensus Engine
    Find heavily supported nodes and synthesize the consensus.
    """
    driver = get_neo4j_driver()
    if not driver:
        return {"status": "error", "message": "Graph DB unavailable"}

    candidates = []
    with driver.session() as session:
        query = """
        MATCH (p:Entity {room_id: $room_id})-[r:SUPPORTS]->(target:Entity {room_id: $room_id})
        WITH target, count(r) AS support_count, collect(p.name) AS supporters, collect(r.source_evidence) AS evidence
        WHERE support_count > 1
        RETURN target.name AS topic, support_count, supporters, evidence
        ORDER BY support_count DESC
        LIMIT 5
        """
        for record in session.run(query, room_id=room_id):
            # flatten evidence lists
            doc_ids = []
            for ev_list in record["evidence"]:
                if ev_list:
                    doc_ids.extend(ev_list)
                    
            candidates.append({
                "topic": record["topic"],
                "support_count": record["support_count"],
                "supporters": record["supporters"],
                "doc_ids": list(set(doc_ids))
            })

    if not candidates:
        return {"status": "success", "consensus": [], "message": "No multi-supported consensus found."}

    results = []
    for candidate in candidates:
        texts = []
        for doc_id_str in candidate["doc_ids"][:3]: # Limit to 3 documents to avoid context overflow
            try:
                doc_id = int(doc_id_str)
                result = await db.execute(select(Document).where(Document.id == doc_id, Document.room_id == room_id)); doc = result.scalars().first()
                if doc: texts.append(doc.content_text[:1000])
            except: pass

        prompt = f"""Analyze the following scientific consensus regarding: {candidate['topic']}
Supported by: {', '.join(candidate['supporters'])}

Source Documents:
{' '.join(texts)}

Synthesize a comprehensive consensus statement explaining why these sources agree and what the unified conclusion is."""

        synthesis = await _call_llm(prompt, user_id, db)
        results.append({
            "topic": candidate['topic'],
            "supporters": candidate['supporters'],
            "synthesis": synthesis
        })

    return {"status": "success", "consensus": results}


async def generate_hypothesis(user_id: int, room_id: int, db: AsyncSession) -> dict:
    """
    Graph-RAG Hypothesis Generation & Cross-Domain Reasoning
    Find short unconnected paths between different domains and hypothesize links.
    """
    driver = get_neo4j_driver()
    if not driver:
        return {"status": "error", "message": "Graph DB unavailable"}

    candidates = []
    with driver.session() as session:
        # Find two nodes that share a common neighbor but aren't connected directly
        query = """
        MATCH (a:Entity {room_id: $room_id})-[:RELATED_TO|AFFECTS|CAUSES]->(common:Entity {room_id: $room_id})<-[:RELATED_TO|AFFECTS|CAUSES]-(b:Entity {room_id: $room_id})
        WHERE NOT (a)-[]-(b) AND a.id <> b.id
        RETURN a.name AS topic1, a.type AS type1, 
               b.name AS topic2, b.type AS type2, 
               common.name AS common_link
        LIMIT 3
        """
        for record in session.run(query, room_id=room_id):
            candidates.append({
                "topic1": record["topic1"],
                "type1": record["type1"],
                "topic2": record["topic2"],
                "type2": record["type2"],
                "common_link": record["common_link"]
            })

    if not candidates:
        return {"status": "success", "hypotheses": [], "message": "No hypothesis candidates found."}

    results = []
    for candidate in candidates:
        prompt = f"""You are a Cross-Domain Research AI. 
I have found an indirect link in the knowledge graph:
Entity A: {candidate['topic1']} ({candidate['type1']})
Entity B: {candidate['topic2']} ({candidate['type2']})
Common Link: {candidate['common_link']}

Entity A and Entity B are NOT directly connected in the current literature. 
Based on their shared relationship with {candidate['common_link']}, generate a novel scientific hypothesis connecting Entity A and Entity B. Explain the theoretical mechanism."""

        synthesis = await _call_llm(prompt, user_id, db)
        results.append({
            "topic1": candidate['topic1'],
            "topic2": candidate['topic2'],
            "common_link": candidate['common_link'],
            "hypothesis": synthesis
        })

    return {"status": "success", "hypotheses": results}
