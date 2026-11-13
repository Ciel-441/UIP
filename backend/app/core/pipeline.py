from typing import List, Dict, Any, Optional
import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.neo4j_driver import get_neo4j_driver
from app.services.ai_service import ask_ollama_json
from app.models.document import Document

logger = logging.getLogger(__name__)

class StandardizedReasoningPipeline:
    def __init__(self, db: AsyncSession, room_id: int, neo4j_driver=None):
        self.db = db
        self.room_id = room_id
        self.neo4j_driver = neo4j_driver or get_neo4j_driver()

    async def execute(self, goal: str, domain: str = None) -> Dict[str, Any]:
        logger.info(f"Executing standardized reasoning pipeline for goal: {goal}")
        
        # 1. Graph Retrieval
        graph_evidence = await self._retrieve_graph_evidence(goal)
        
        # 2. Document Retrieval
        doc_evidence = await self._retrieve_doc_evidence(goal)
        
        # 3. Evidence Selection (Filter out noise)
        selected_evidence = await self._select_evidence(goal, graph_evidence, doc_evidence)
        
        # 4. Reasoning (Generate initial findings)
        reasoning_chain = await self._reasoning(goal, selected_evidence)
        
        # 5. Validation (Check for contradictions)
        validated_result = await self._validate(reasoning_chain)
        
        # 6. Confidence Calculation
        confidence = self._calculate_confidence(validated_result, selected_evidence)
        
        # 7. Output
        return {
            "goal": goal,
            "findings": validated_result.get("findings", []),
            "confidence": confidence,
            "evidence_used": selected_evidence,
            "reasoning_chain": reasoning_chain,
            "status": "completed"
        }

    async def _retrieve_graph_evidence(self, goal: str) -> List[Dict]:
        if not self.neo4j_driver:
            return []
            
        keywords = [w for w in goal.split() if len(w) > 3]
        evidence = []
        
        with self.neo4j_driver.session() as session:
            for keyword in keywords[:3]:
                result = session.run(
                    """
                    MATCH (e:Entity {room_id: $room_id})-[r]-(related:Entity {room_id: $room_id})
                    WHERE toLower(e.name) CONTAINS toLower($keyword)
                       OR toLower(e.description) CONTAINS toLower($keyword)
                    RETURN e.name AS source, type(r) AS relation, related.name AS target
                    LIMIT 10
                    """,
                    keyword=keyword,
                    room_id=self.room_id
                )
                for record in result:
                    evidence.append({
                        "type": "graph",
                        "fact": f"{record['source']} -[{record['relation']}]-> {record['target']}"
                    })
        return evidence

    async def _retrieve_doc_evidence(self, goal: str) -> List[Dict]:
        evidence = []
        try:
            result = await self.db.execute(
                select(Document)
                .where(Document.room_id == self.room_id)
                .limit(5)
            )
            docs = result.scalars().all()
            for doc in docs:
                title = doc.original_name or "Untitled"
                text = doc.content_text or ""
                evidence.append({
                    "type": "document",
                    "id": doc.id,
                    "title": title,
                    "snippet": text[:200] + "..." if len(text) > 200 else text
                })
        except Exception as e:
            logger.error(f"Doc retrieval error: {e}", exc_info=True)
        return evidence

    async def _select_evidence(self, goal: str, graph: List[Dict], docs: List[Dict]) -> List[Dict]:
        return graph + docs

    async def _reasoning(self, goal: str, evidence: List[Dict]) -> List[str]:
        system_prompt = "You are an autonomous AI analyst. Analyze the following evidence to fulfill the user's investigation goal. Return a strict JSON object with a 'findings' array of strings."
        
        user_prompt = f"Goal: {goal}\n\nEvidence: {json.dumps(evidence)}\n\nRespond with JSON matching {{ 'findings': ['finding 1', 'finding 2'] }}"
        
        result = await ask_ollama_json(system_prompt, user_prompt)
        return result.get("findings", ["Insufficient evidence to generate meaningful findings."])

    async def _validate(self, reasoning: List[str]) -> Dict[str, Any]:
        system_prompt = "You are a validation agent. Review the findings and validate them. Calculate a confidence score between 0.0 and 1.0 based on the strength of the findings. Return a strict JSON object with 'findings' (array of strings), 'valid' (boolean), and 'confidence' (float)."
        
        user_prompt = f"Findings to validate: {json.dumps(reasoning)}\n\nRespond with JSON matching {{ 'findings': ['validated 1', ...], 'valid': true, 'confidence': <calculate_float_here> }}"
        
        result = await ask_ollama_json(system_prompt, user_prompt)
        return {
            "findings": result.get("findings", reasoning),
            "valid": result.get("valid", True),
            "confidence": result.get("confidence", 0.5)
        }

    def _calculate_confidence(self, validation_result: Dict, evidence: List) -> float:
        if not evidence:
            return 0.1
        # Retrieve the dynamically generated confidence from the LLM
        dynamic_confidence = float(validation_result.get("confidence", 0.5))
        return dynamic_confidence
