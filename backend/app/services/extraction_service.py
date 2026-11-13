"""Extraction service – use Ollama to extract entities/relationships from document text."""

import json
import re
import logging
import asyncio

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.activity import Activity
from app.services import entity_service, relationship_service
from app.services.document_service import get_document, update_document_status
from app.utils.sanitization import sanitize_text, sanitize_label, contains_profanity_or_slur

logger = logging.getLogger(__name__)



ONTOLOGIES = {
    "open": {
        "entities": ["Any relevant concept"],
        "relationships": ["Any logical relationship"]
    },
    "agriculture": {
        "entities": ["Plant", "Animal", "Disease", "Chemical", "Climate", "Soil"],
        "relationships": ["affects", "causes", "treated_by", "related_to", "depends_on", "found_in"]
    },
    "medicine": {
        "entities": ["Disease", "Drug", "Symptom", "Treatment", "Pathogen"],
        "relationships": ["causes", "treats", "prevents", "associated_with", "exhibits"]
    },
    "veterinary": {
        "entities": ["Animal", "Breed", "Feed", "Disease", "Vaccine"],
        "relationships": ["affects", "consumes", "prevents", "treated_with"]
    }
}

def build_extraction_prompt(text: str, ontology_mode: str = "open") -> str:
    schema = ONTOLOGIES.get(ontology_mode, ONTOLOGIES["open"])
    
    if ontology_mode == "open":
        return f"""Analyze the following text and extract ALL relevant conceptual and metadata entities along with their relationships.

REQUIRED METADATA EXTRACTION:
If present in the text, you must extract:
- Entity Types: Paper, Author, Person, Institution, Citation, Finding, Conclusion, Method, Religion, Ethnic_Group, Location, Organization, Project, Political_Ideology, Historical_Figure, Political_Movement
- Relationship Types: CITES, AUTHORED, PUBLISHED, SUPPORTS, CONTRADICTS, WROTE, RESEARCHED, FOUND, IMPLEMENTED_IN, LOCATED_AT, CO_AUTHOR

DOMAIN EXTRACTION:
In addition to the metadata above, extract any general concepts, processes, chemicals, technologies, roles, crops, or materials discussed in the text.
CRITICAL: Match entities to their most specific and accurate category (e.g., use "Religion" for religions/beliefs, "Ethnic_Group" for ethnicities/peoples). NEVER classify a Religion, belief system, or Ethnic Group as "Technology", "Process", or "Role".
CRITICAL: Use the EXACT, original text of the entity name as it appears in the document. Do not generalize or categorize the name itself (e.g., use the name "Muslim" under the type "Religion" or "Ethnic_Group", do not use "Islam" or "Religion" as the name).

CRITICAL INSTRUCTIONS:
1. Be extremely thorough. Extract all entities and relationships present in the text.
2. Keep descriptions extremely short (under 6 words). E.g., "Agricultural crop" or "Chemical element".
3. For Author entities, you MUST connect them using specific actions like "WROTE", "RESEARCHED", or "FOUND" if supported by the text. If multiple Authors are simply listed together and their specific action is unclear, connect them to each other using the "CO_AUTHOR" relationship. NEVER use the generic "RELATED_TO" relationship for Authors.
4. For Project entities connected to Locations, use "IMPLEMENTED_IN" or "LOCATED_AT". Do NOT use "PUBLISHED".
5. CRITICAL: Do NOT combine multiple individuals, locations, organizations, or concepts into a single entity. If the text lists multiple items (e.g., 'Farmers Aman Sharma, Priya Verma, Rahul Singh'), you MUST extract each as a separate, individual entity (e.g., 'Aman Sharma' [Person], 'Priya Verma' [Person], 'Rahul Singh' [Person]), never as a single comma-separated list or joint name. Also, do NOT extract generic collective groups, generic roles, or plural occupations (like 'Farmers', 'Agricultural researchers', 'scientists', 'agronomists') as 'Author' or 'Person' entities. 'Author' and 'Person' are strictly for specific named individuals. Generic roles, groups, or occupations must be classified as 'Role' or 'Concept'.
6. CRITICAL: Every source_name and target_name used in the relationships array MUST be defined as an entity in the entities array with matching name. Do not reference any entity names in relationships that are not declared in the entities array.
7. CRITICAL: NEVER classify political ideologies, political beliefs, or regimes (like Nazism, Fascism, Nazi, Neo-Nazism) as "Religion" or "Ethnic_Group". Classify them as "Political_Ideology" or "Political_Movement". Similarly, classify historical figures, political leaders, or dictates (like Adolf Hitler) as "Historical_Figure", never as "Religion" or "Ethnic_Group".
8. CRITICAL: DO NOT extract the prompt examples (like "Agricultural crop", "Chemical element", "Author", "Institution", "Finding") unless corresponding entities or concepts actually exist or are clearly implied in the text.
9. CRITICAL: If the text is empty, gibberish, contains no actual information, or has no valid entities/relationships, you MUST return an empty JSON structure: {{"entities": [], "relationships": []}}. Do not make things up.
6. Return ONLY a JSON object with this exact structure (no other text or explanation):

{{
  "entities": [
    {{
      "name": "Entity Name",
      "type": "Entity Type (e.g. Concept, Chemical, Crop, Role, Technology, Location, Process, Paper, Author, Person, Institution, Religion, Ethnic_Group, Organization, Political_Ideology, Historical_Figure, Political_Movement)",
      "description": "Short description"
    }}
  ],
  "relationships": [
    {{
      "source_name": "Source Entity Name",
      "target_name": "Target Entity Name",
      "type": "RELATIONSHIP_TYPE",
      "description": "Short relationship description"
    }}
  ]
}}

Text to analyze:
{text}"""
    else:
        return f"""Analyze the following text and extract domain-specific knowledge using ONLY the specified types.

CRITICAL INSTRUCTIONS:
1. Extract ONLY entities matching the allowed types: {', '.join(schema['entities'])}
2. Extract ONLY relationships matching the allowed types: {', '.join(schema['relationships'])}
3. Keep descriptions extremely short (under 6 words).
4. CRITICAL: DO NOT extract or invent entities that do not appear in the text. If no valid entities matching the allowed types are present, you MUST return an empty JSON structure: {{"entities": [], "relationships": []}}. Do not make things up.
5. Return ONLY a JSON object with this exact structure (no other text or explanation):

{{
  "entities": [
    {{
      "name": "Entity Name",
      "type": "Entity Type",
      "description": "Short description"
    }}
  ],
  "relationships": [
    {{
      "source_name": "Source Entity Name",
      "target_name": "Target Entity Name",
      "type": "RELATIONSHIP_TYPE",
      "description": "Short relationship description"
    }}
  ]
}}

Text to analyze:
{text}"""

def chunk_text(text: str, chunk_size: int = 4000, overlap: int = 400) -> list:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start += (chunk_size - overlap)
    return chunks


def merge_extracted_data(chunk_results: list) -> tuple:
    merged_entities = {}
    merged_relationships = set()
    relationships_list = []

    for result in chunk_results:
        if not isinstance(result, dict):
            continue
        # Deduplicate and merge entities
        for ent in result.get("entities", []):
            if not isinstance(ent, dict):
                continue
            name = sanitize_text(ent.get("name", ""), 100)
            if not name:
                continue
            if contains_profanity_or_slur(name) or contains_profanity_or_slur(ent.get("description", "")):
                logger.warning(f"Filtered out entity containing inappropriate language or slurs: {name}")
                continue
            ent_type = sanitize_label(ent.get("type", ""), "Concept")
            description = sanitize_text(ent.get("description", ""), 500)
            
            # Sanitize confidence score in properties
            properties = ent.get("properties", {})
            sanitized_props = {"confidence_score": 1.0}
            if isinstance(properties, dict):
                for k, v in properties.items():
                    clean_k = re.sub(r'[^a-zA-Z0-9_]', '', str(k))[:50]
                    if clean_k:
                        if isinstance(v, (int, float)):
                            sanitized_props[clean_k] = v
                        elif isinstance(v, bool):
                            sanitized_props[clean_k] = v
                        else:
                            sanitized_props[clean_k] = sanitize_text(str(v), 200)

            key = (name.lower(), ent_type.lower())
            
            if key not in merged_entities:
                merged_entities[key] = {
                    "name": name,
                    "type": ent_type,
                    "description": description,
                    "properties": sanitized_props
                }
            else:
                existing = merged_entities[key]
                new_desc = description
                if len(new_desc) > len(existing["description"]):
                    existing["description"] = new_desc
                try:
                    conf1 = float(existing["properties"].get("confidence_score", 1.0))
                    conf2 = float(sanitized_props.get("confidence_score", 1.0))
                    existing["properties"]["confidence_score"] = max(conf1, conf2)
                except Exception:
                    pass

        # Deduplicate and filter relationships
        for rel in result.get("relationships", []):
            if not isinstance(rel, dict):
                continue
            source = sanitize_text(rel.get("source_name", ""), 100)
            target = sanitize_text(rel.get("target_name", ""), 100)
            if contains_profanity_or_slur(source) or contains_profanity_or_slur(target) or contains_profanity_or_slur(rel.get("description", "")):
                logger.warning(f"Filtered out relationship containing inappropriate language or slurs: {source} -> {target}")
                continue
            rel_type = sanitize_label(rel.get("type", ""), "RELATED_TO").upper()
            
            if not source or not target or not rel_type:
                continue
            
            # Avoid self-referential relationships
            if source.lower() == target.lower():
                continue
                
            description = sanitize_text(rel.get("description", ""), 500)
            
            key = (source.lower(), target.lower(), rel_type.lower())
            if key not in merged_relationships:
                merged_relationships.add(key)
                relationships_list.append({
                    "source_name": source,
                    "target_name": target,
                    "type": rel_type,
                    "description": description
                })

                
    return list(merged_entities.values()), relationships_list


def repair_truncated_json(text: str) -> dict:
    """Attempt to repair a truncated JSON response by stripping incomplete trailing items and closing structures."""
    text = text.strip()
    if not text:
        return {"entities": [], "relationships": []}
        
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    stack = []
    in_string = False
    escape = False
    last_valid_comma_or_bracket = -1
    
    for i, char in enumerate(text):
        if char == '"' and not escape:
            in_string = not in_string
        elif char == '\\' and in_string:
            escape = not escape
            continue
            
        if not in_string:
            if char in ('{', '['):
                stack.append((char, i))
            elif char in ('}', ']'):
                if stack:
                    stack.pop()
                    last_valid_comma_or_bracket = i
            elif char == ',' and len(stack) == 1 and stack[-1][0] == '[':
                last_valid_comma_or_bracket = i
        
        if escape:
            escape = False
            
    if last_valid_comma_or_bracket != -1:
        repaired_text = text[:last_valid_comma_or_bracket + 1].rstrip().rstrip(',')
        
        stack = []
        in_string = False
        escape = False
        for char in repaired_text:
            if char == '"' and not escape:
                in_string = not in_string
            elif char == '\\' and in_string:
                escape = not escape
                continue
            if not in_string:
                if char in ('{', '['):
                    stack.append(char)
                elif char in ('}', ']'):
                    if stack:
                        stack.pop()
            if escape:
                escape = False
                
        closing_chars = []
        for open_char in reversed(stack):
            if open_char == '{':
                closing_chars.append('}')
            elif open_char == '[':
                closing_chars.append(']')
                
        final_json = repaired_text + "".join(closing_chars)
        try:
            return json.loads(final_json)
        except Exception:
            pass
            
    return {"entities": [], "relationships": []}


async def process_chunk(sem: asyncio.Semaphore, client: httpx.AsyncClient, endpoint: str, model: str, prompt: str) -> dict:
    async with sem:
        try:
            response = await client.post(
                f"{endpoint}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {
                        "num_predict": 4096,
                        "temperature": 0.1,
                        "repeat_penalty": 1.1
                    }
                },
            )
            response.raise_for_status()
            data = response.json()
            response_text = data.get("response", "{}")
            
            try:
                return json.loads(response_text)
            except json.JSONDecodeError:
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    matched_str = json_match.group()
                    try:
                        return json.loads(matched_str)
                    except json.JSONDecodeError:
                        # Try repairing truncated JSON
                        repaired = repair_truncated_json(matched_str)
                        if repaired.get("entities") or repaired.get("relationships"):
                            logger.warning(f"Successfully repaired truncated LLM response. Extracted {len(repaired.get('entities', []))} entities.")
                            return repaired
                
                # Try repairing raw response text directly
                repaired = repair_truncated_json(response_text)
                if repaired.get("entities") or repaired.get("relationships"):
                    logger.warning(f"Successfully repaired truncated LLM response. Extracted {len(repaired.get('entities', []))} entities.")
                    return repaired

                logger.error(f"Failed to parse chunk LLM response: {response_text}")
                return {"entities": [], "relationships": []}
        except Exception as e:
            logger.error(f"Error processing chunk: {e}")
            return {"entities": [], "relationships": []}


async def progress_ticker(doc_id: int, room_id: int, progress_state: dict, stop_event: asyncio.Event):
    """Periodically increment document progress in the database to simulate smooth loading."""
    from app.database import async_session_maker
    from app.services.document_service import update_document_status
    
    while not stop_event.is_set():
        await asyncio.sleep(2.0)
        if stop_event.is_set():
            break
        
        # Slowly increment simulated progress up to 90%
        if progress_state["progress"] < 90:
            progress_state["progress"] += 4
            if progress_state["progress"] > 90:
                progress_state["progress"] = 90
                
            try:
                async with async_session_maker() as session:
                    await update_document_status(doc_id, "processing", room_id, session, progress=progress_state["progress"])
                    await session.commit()
            except Exception:
                pass


async def extract_entities_from_document(doc_id: int, room_id: int, db: AsyncSession = None, ontology_mode: str = "open") -> dict:
    """Send document text in parallel chunks to Ollama and extract entities and relationships."""
    from app.database import async_session_maker

    # Phase 1: Read document and update status to processing
    async with async_session_maker() as session:
        doc = await get_document(doc_id, room_id, session)
        if not doc:
            return {"entities": [], "relationships": [], "error": "Document not found"}

        if not doc.content_text or not doc.content_text.strip():
            return {
                "entities": [],
                "relationships": [],
                "error": "Document has no text content",
            }

        # Check for inappropriate language/slurs in the document
        if contains_profanity_or_slur(doc.content_text):
            logger.warning(f"Aborting extraction for document {doc_id} due to detected inappropriate language or slurs.")
            doc.extracted_entities = [{"error": "Inappropriate language used"}]
            await update_document_status(doc_id, "error", room_id, session)
            await session.commit()
            return {
                "entities": [],
                "relationships": [],
                "error": "Document contains inappropriate language or slurs. Extraction blocked.",
            }

        # Update status to processing immediately in DB
        await update_document_status(doc_id, "processing", room_id, session, progress=0)
        
        text = doc.content_text  
        
        from app.services.ai_service import get_user_settings
        user_settings = await get_user_settings(doc.user_id, session)
        endpoint = user_settings["endpoint"]
        model = user_settings["model"]
        
        await session.commit()

    # Split document text into chunks
    chunks = chunk_text(text, chunk_size=4000, overlap=400)
    logger.info(f"Splitting document {doc_id} into {len(chunks)} chunks for parallel extraction.")

    sem = asyncio.Semaphore(3)  # Protect Ollama from excessive parallel load

    progress_state = {"progress": 0}
    stop_event = asyncio.Event()
    ticker_task = asyncio.create_task(progress_ticker(doc_id, room_id, progress_state, stop_event))

    try:
        chunk_results = []
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                tasks = []
                for chunk in chunks:
                    prompt = build_extraction_prompt(chunk, ontology_mode)
                    tasks.append(process_chunk(sem, client, endpoint, model, prompt))
                    
                total_chunks = len(tasks)
                completed_chunks = 0
                
                for future in asyncio.as_completed(tasks):
                    res = await future
                    chunk_results.append(res)
                    completed_chunks += 1
                    progress_pct = int((completed_chunks / total_chunks) * 100) if total_chunks > 0 else 100
                    
                    # Update progress state to the actual chunk completion progress
                    progress_state["progress"] = max(progress_state["progress"], progress_pct)
                    
                    # Update progress in DB using a new session transaction
                    async with async_session_maker() as session:
                        await update_document_status(doc_id, "processing", room_id, session, progress=progress_state["progress"])
                        await session.commit()
        finally:
            stop_event.set()
            await ticker_task

        # Merge and deduplicate results
        entities, relationships = merge_extracted_data(chunk_results)

        # Phase 2: Save the extracted results in a new transaction
        async with async_session_maker() as session:
            doc = await get_document(doc_id, room_id, session)
            if doc:
                doc.extracted_entities = entities
                doc.extracted_relationships = relationships
                await session.flush()
                await update_document_status(doc_id, "extracted", room_id, session, entity_count=len(entities), progress=100)
                await session.commit()

        return {"entities": entities, "relationships": relationships}

    except httpx.ConnectError:
        async with async_session_maker() as session:
            await update_document_status(doc_id, "error", room_id, session)
            await session.commit()
        return {
            "entities": [],
            "relationships": [],
            "error": "Could not connect to Ollama. Make sure the Ollama service is running.",
        }
    except httpx.TimeoutException:
        async with async_session_maker() as session:
            await update_document_status(doc_id, "error", room_id, session)
            await session.commit()
        return {
            "entities": [],
            "relationships": [],
            "error": "Ollama request timed out. The document may be too large.",
        }
    except Exception as e:
        logger.exception("Extraction error")
        async with async_session_maker() as session:
            await update_document_status(doc_id, "error", room_id, session)
            await session.commit()
        return {
            "entities": [],
            "relationships": [],
            "error": f"Extraction failed: {str(e)}",
        }


async def confirm_extraction(
    doc_id: int,
    room_id: int,
    entities: list,
    relationships: list,
    user_id: int,
    db: AsyncSession,
) -> dict:
    """Create confirmed entities and relationships in Neo4j and log activities."""
    entities_created = 0
    relationships_created = 0

    # Create entities
    for ent in entities:
        try:
            name = ent.get("name", ent.name if hasattr(ent, "name") else "")
            if not name:
                continue

            # Check if entity already exists (case-insensitive due to previous fix)
            existing = entity_service.get_entity_by_name(room_id, name)
            if existing:
                continue

            properties = ent.get("properties", ent.properties if hasattr(ent, "properties") else {})
            confidence = properties.get("confidence_score", 1.0) if isinstance(properties, dict) else 1.0
            
            created = entity_service.create_entity(
                room_id=room_id,
                name=name,
                type=ent.get("type", ent.type if hasattr(ent, "type") else ""),
                description=ent.get("description", ent.description if hasattr(ent, "description") else ""),
                properties=properties,
                source_document_id=str(doc_id),
                confidence_score=float(confidence)
            )
            if created:
                entities_created += 1
                # Log activity
                activity = Activity(
                    room_id=room_id,
                    action="created",
                    entity_type="entity",
                    entity_id=created.get("id", ""),
                    details=f"Extracted entity: {created.get('name', '')}",
                    user_id=user_id,
                )
                db.add(activity)
        except Exception as e:
            logger.warning(f"Failed to create entity {ent}: {e}")

    # Build name-to-id mapping for relationship creation
    name_to_id = {}
    for ent in entities:
        name = ent.get("name", ent.name if hasattr(ent, "name") else "")
        found = entity_service.get_entity_by_name(room_id, name)
        if found:
            name_to_id[name] = found["id"]

    # Create relationships
    for rel in relationships:
        try:
            source_name = rel.get("source_name", rel.source_name if hasattr(rel, "source_name") else "")
            target_name = rel.get("target_name", rel.target_name if hasattr(rel, "target_name") else "")
            source_id = name_to_id.get(source_name)
            target_id = name_to_id.get(target_name)

            if not source_id:
                found = entity_service.get_entity_by_name(room_id, source_name)
                source_id = found["id"] if found else None
            if not target_id:
                found = entity_service.get_entity_by_name(room_id, target_name)
                target_id = found["id"] if found else None

            # Fallback: auto-create missing source entity
            if not source_id:
                created_src = entity_service.create_entity(
                    room_id=room_id,
                    name=source_name,
                    type="Concept",
                    description="Automatically resolved concept",
                    source_document_id=str(doc_id),
                    confidence_score=1.0
                )
                if created_src:
                    source_id = created_src.get("id")
                    name_to_id[source_name] = source_id
                    activity = Activity(
                        room_id=room_id,
                        action="created",
                        entity_type="entity",
                        entity_id=source_id,
                        details=f"Extracted entity (auto-resolved): {source_name}",
                        user_id=user_id,
                    )
                    db.add(activity)
                    entities_created += 1

            # Fallback: auto-create missing target entity
            if not target_id:
                created_tgt = entity_service.create_entity(
                    room_id=room_id,
                    name=target_name,
                    type="Concept",
                    description="Automatically resolved concept",
                    source_document_id=str(doc_id),
                    confidence_score=1.0
                )
                if created_tgt:
                    target_id = created_tgt.get("id")
                    name_to_id[target_name] = target_id
                    activity = Activity(
                        room_id=room_id,
                        action="created",
                        entity_type="entity",
                        entity_id=target_id,
                        details=f"Extracted entity (auto-resolved): {target_name}",
                        user_id=user_id,
                    )
                    db.add(activity)
                    entities_created += 1

            if source_id and target_id:
                rel_props = rel.get("properties", rel.properties if hasattr(rel, "properties") else {})
                confidence = rel_props.get("confidence_score", 1.0) if isinstance(rel_props, dict) else 1.0
                
                created = relationship_service.create_relationship(
                    room_id=room_id,
                    type=rel.get("type", rel.type if hasattr(rel, "type") else "related_to"),
                    source_id=source_id,
                    target_id=target_id,
                    description=rel.get("description", rel.description if hasattr(rel, "description") else ""),
                    confidence_score=float(confidence),
                    source_evidence=[str(doc_id)]
                )
                if created:
                    relationships_created += 1
                    activity = Activity(
                        room_id=room_id,
                        action="created",
                        entity_type="relationship",
                        entity_id=created.get("id", ""),
                        details=f"Extracted relationship: {source_name} -> {target_name}",
                        user_id=user_id,
                    )
                    db.add(activity)
        except Exception as e:
            logger.warning(f"Failed to create relationship {rel}: {e}")

    # Update document status
    await update_document_status(doc_id, "confirmed", room_id, db, entity_count=len(entities))
    await db.commit()

    # Automatically trigger orphan linking in the background
    try:
        from app.services.discovery_engine import auto_link_orphans
        from app.neo4j_driver import get_neo4j_driver
        from app.database import async_session_maker

        driver = get_neo4j_driver()
        if driver:
            async def run_auto_link_background():
                try:
                    async with async_session_maker() as background_session:
                        logger.info(f"Automatically triggering relationship sorting for room {room_id} post-extraction")
                        await auto_link_orphans(
                            room_id=room_id,
                            driver=driver,
                            user_id=user_id,
                            db=background_session
                        )
                except Exception as ex:
                    logger.error(f"Error in automatic background auto_link_orphans: {ex}")

            asyncio.create_task(run_auto_link_background())
    except Exception as e:
        logger.error(f"Failed to initiate automatic relationship sorting: {e}")

    return {
        "entities_created": entities_created,
        "relationships_created": relationships_created,
        "total_processed": len(entities)
    }

