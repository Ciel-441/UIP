from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class EntityCreate(BaseModel):
    name: str
    type: str
    description: str = ""
    properties: Dict[str, Any] = {}


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class EntityResponse(BaseModel):
    id: str
    name: str
    type: str
    description: str = ""
    properties: Dict[str, Any] = {}
    created_at: Optional[str] = None
    source_document_id: Optional[str] = None
    confidence_score: float = 1.0
    source_evidence: List[str] = []
    aliases: List[str] = []
    modification_history: List[Dict[str, Any]] = []
    citation_count: int = 0


class RelationshipInfo(BaseModel):
    id: str
    type: str
    source_id: str
    target_id: str
    source_name: str = ""
    target_name: str = ""
    description: str = ""
    created_at: Optional[str] = None
    confidence_score: float = 1.0
    source_evidence: List[str] = []
    modification_history: List[Dict[str, Any]] = []


class ConnectionsData(BaseModel):
    incoming: List[RelationshipInfo] = []
    outgoing: List[RelationshipInfo] = []


class EntityDetailResponse(BaseModel):
    id: str
    name: str
    type: str
    description: str = ""
    properties: Dict[str, Any] = {}
    created_at: Optional[str] = None
    source_document_id: Optional[str] = None
    confidence_score: float = 1.0
    source_evidence: List[str] = []
    aliases: List[str] = []
    modification_history: List[Dict[str, Any]] = []
    citation_count: int = 0
    connections: ConnectionsData = ConnectionsData()


class EntityListResponse(BaseModel):
    items: List[EntityResponse] = []
    total: int = 0


class EntityMergeRequest(BaseModel):
    target_id: str
    source_id: str
