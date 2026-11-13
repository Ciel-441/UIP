from typing import Optional, List, Any
from pydantic import BaseModel


class SearchResult(BaseModel):
    id: str
    type: str  # "entity" | "relationship" | "document"
    name: str
    description: str = ""
    relevance: float = 0.0
    related_entities: Optional[List[Any]] = None
    source_document: Optional[str] = None


class SearchResponse(BaseModel):
    results: List[SearchResult] = []


class AIQueryRequest(BaseModel):
    question: str


class Citation(BaseModel):
    entity_id: Optional[str] = None
    document_id: Optional[int] = None
    name: str = ""
    type: str = ""
    excerpt: str = ""


class AIQueryResponse(BaseModel):
    answer: str
    citations: List[dict] = []
    related_entities: List[dict] = []
    follow_up_suggestions: List[str] = []
    confidence_score: Optional[float] = None
    reasoning_chain: List[str] = []


class AIStatusResponse(BaseModel):
    ollama_available: bool
    model: str
    available_models: List[str] = []
