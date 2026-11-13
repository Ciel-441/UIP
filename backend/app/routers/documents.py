"""Documents router – upload, retrieve, extract, and confirm documents."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, Activity, Document
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    ExtractionResponse,
    ConfirmRequest,
    ConfirmResponse,
    BulkImportResponse,
)
from app.services import document_service, extraction_service
from app.utils.security import get_current_user
from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership
from app.utils.rate_limit import limiter

router = APIRouter()


def format_document(doc: Document) -> dict:
    """Convert a Document ORM instance to a response dict."""
    return {
        "id": doc.id,
        "filename": doc.filename,
        "original_name": doc.original_name,
        "status": doc.status,
        "progress": doc.progress,
        "content_text": doc.content_text,
        "user_id": doc.user_id,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "entity_count": doc.entity_count,
        "extracted_entities": doc.extracted_entities,
        "extracted_relationships": doc.extracted_relationships,
    }


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    limit: int = 20,
    offset: int = 0,
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """List all documents."""
    items, total = await document_service.list_documents(
        user_id=membership.user.id,
        db=db,
        limit=limit,
        offset=offset,
        room_id=membership.room_id,
    )
    return {
        "items": [format_document(doc) for doc in items],
        "total": total,
    }


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document file, extract its text, and store in the database."""
    doc = await document_service.upload_document(
        file=file,
        user_id=membership.user.id,
        db=db,
        room_id=membership.room_id,
    )

    # Log activity
    activity = Activity(
        room_id=membership.room_id,
        action="created",
        entity_type="document",
        entity_id=str(doc.id),
        details=f"Uploaded document: {doc.original_name}",
        user_id=membership.user.id,
    )
    db.add(activity)
    await db.flush()

    return format_document(doc)


@router.post("/bulk-import", response_model=BulkImportResponse)
@limiter.limit("10/minute")
async def bulk_import(
    request: Request,
    file: UploadFile = File(...),
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import structured knowledge from JSON or CSV."""
    result = await document_service.bulk_import_documents(
        file=file, 
        user_id=membership.user.id, 
        room_id=membership.room_id, 
        db=db
    )
    
    # Log activity
    if result["imported_count"] > 0:
        activity = Activity(
            room_id=membership.room_id,
            action="bulk_imported",
            entity_type="document",
            entity_id="bulk",
            details=f"Bulk imported {result['imported_count']} entities from {file.filename}",
            user_id=membership.user.id,
        )
        db.add(activity)
        await db.flush()
        
    return result


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    membership: RoomMembership = Depends(get_room_membership),
    db: AsyncSession = Depends(get_db),
):
    """Get a single document including its content text."""
    doc = await document_service.get_document(doc_id=document_id, room_id=membership.room_id, db=db)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )
    return format_document(doc)


@router.post("/{document_id}/extract", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
async def extract_entities(
    request: Request,
    document_id: int,
    background_tasks: BackgroundTasks,
    ontology_mode: str = "open",
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Extract entities and relationships from a document using AI (runs in background)."""
    doc = await document_service.get_document(doc_id=document_id, room_id=membership.room_id, db=db)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )

    # Update status to processing immediately and commit so the frontend sees it!
    from app.services.document_service import update_document_status
    await update_document_status(doc_id=document_id, status="processing", room_id=membership.room_id, db=db)
    await db.commit()

    # Run the heavy extraction process in the background
    # We must pass a new database session if we were using a scoped session,
    # but FastAPI Depends(get_db) yields a session that closes after the response.
    # Actually, BackgroundTasks share the same request context for dependencies in older FastAPI,
    # but to be safe with AsyncSession, we should either spawn a new session or use the existing one if it stays open.
    # By default, FastAPI's BackgroundTasks execute after the response but the dependencies might be closed.
    
    # Since background_tasks run AFTER the response is sent, the db session from Depends(get_db) will be closed.
    # We need to create a new session inside the background task.
    async def extract_task(doc_id, mode):
        try:
            await extraction_service.extract_entities_from_document(
                doc_id=doc_id,
                room_id=membership.room_id,
                ontology_mode=mode
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Background extraction task failed")

    background_tasks.add_task(extract_task, document_id, ontology_mode)

    return {
        "status": "processing",
        "message": "Extraction started in the background."
    }


@router.post("/{document_id}/confirm", response_model=ConfirmResponse)
async def confirm_extraction(
    document_id: int,
    body: ConfirmRequest,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Confirm extracted entities and relationships, creating them in the knowledge graph."""
    doc = await document_service.get_document(doc_id=document_id, room_id=membership.room_id, db=db)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )

    result = await extraction_service.confirm_extraction(
        doc_id=document_id,
        entities=[e.model_dump() for e in body.entities],
        relationships=[r.model_dump() for r in body.relationships],
        user_id=membership.user.id,
        db=db,
        room_id=membership.room_id,
    )

    return result


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a document and its file from disk."""
    import os
    from app.config import settings

    doc = await document_service.get_document(doc_id=document_id, room_id=membership.room_id, db=db)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )

    # Delete physical file
    file_path = os.path.join(settings.UPLOAD_DIR, doc.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    # Log activity
    activity = Activity(
        room_id=membership.room_id,
        action="deleted",
        entity_type="document",
        entity_id=str(doc.id),
        details=f"Deleted document: {doc.original_name}",
        user_id=membership.user.id,
    )
    db.add(activity)

    # Delete from database
    await db.delete(doc)
    await db.flush()

    return {"success": True}


@router.post("/{document_id}/reset")
async def reset_document(
    document_id: int,
    membership: RoomMembership = Depends(RequireRole(["admin", "editor"])),
    db: AsyncSession = Depends(get_db),
):
    """Reset a document to 'uploaded' status to allow re-extraction."""
    doc = await document_service.get_document(doc_id=document_id, room_id=membership.room_id, db=db)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )

    doc.extracted_entities = []
    doc.extracted_relationships = []
    
    from app.services.document_service import update_document_status
    await update_document_status(doc_id=document_id, status="uploaded", room_id=membership.room_id, db=db, entity_count=0)
    await db.commit()

    return {"success": True}
