from typing import Optional, List
from pydantic import BaseModel


class RelationshipCreate(BaseModel):
    type: str
    source_id: str
    target_id: str
    description: str = ""


class RelationshipResponse(BaseModel):
    id: str
    type: str
    source_id: str
    target_id: str
    source_name: str = ""
    target_name: str = ""
    description: str = ""
    created_at: Optional[str] = None
    source_evidence: List[str] = []

class RelationshipListResponse(BaseModel):
    items: List[RelationshipResponse] = []
    total: int = 0
