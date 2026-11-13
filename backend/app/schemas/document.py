from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    status: str = "uploaded"
    progress: Optional[int] = 0
    content_text: Optional[str] = None
    user_id: int
    created_at: Optional[str] = None
    entity_count: Optional[int] = None
    extracted_entities: Optional[List[Dict[str, Any]]] = None
    extracted_relationships: Optional[List[Dict[str, Any]]] = None


class DocumentListResponse(BaseModel):
    items: List[DocumentResponse] = []
    total: int = 0


class ExtractedEntity(BaseModel):
    name: str
    type: str
    description: str = ""
    properties: Dict[str, Any] = {}


class ExtractedRelationship(BaseModel):
    source_name: str
    target_name: str
    type: str
    description: str = ""


class ExtractionResponse(BaseModel):
    entities: List[ExtractedEntity] = []
    relationships: List[ExtractedRelationship] = []


class ConfirmRequest(BaseModel):
    entities: List[ExtractedEntity] = []
    relationships: List[ExtractedRelationship] = []


class ConfirmResponse(BaseModel):
    entities_created: int = 0
    relationships_created: int = 0


class BulkImportResponse(BaseModel):
    success: bool
    imported_count: int = 0
    errors: List[str] = []
