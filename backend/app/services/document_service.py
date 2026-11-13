"""Document service – upload, retrieve, and manage documents in PostgreSQL."""

import os
import uuid

from fastapi import UploadFile, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.document import Document
from app.utils.text_extraction import extract_text
from app.utils.file_validation import validate_file_upload, ALLOWED_DOC_EXTENSIONS, ALLOWED_IMPORT_EXTENSIONS


async def upload_document(
    file: UploadFile, user_id: int, room_id: int, db: AsyncSession
) -> Document:
    """Save an uploaded file to disk, extract text, and create a DB record."""
    # Validate file
    ext = await validate_file_upload(file, ALLOWED_DOC_EXTENSIONS, fallback_ext=".txt")
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Save file to disk in chunks to avoid OOM for large files
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    total_size = 0
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):  # 1 MB chunks
            total_size += len(chunk)
            if total_size > MAX_FILE_SIZE:
                f.close()
                os.remove(file_path)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="File too large. Maximum allowed size is 50MB."
                )
            f.write(chunk)

    # Extract text
    content_text = None
    status_value = "uploaded"
    try:
        content_text = extract_text(file_path, file.filename or "file.txt")
        if content_text and content_text.strip():
            status_value = "uploaded"
        else:
            content_text = ""
    except Exception:
        content_text = ""
        status_value = "uploaded"

    # Create document record
    doc = Document(
        filename=unique_filename,
        original_name=file.filename or "untitled",
        content_text=content_text,
        status=status_value,
        user_id=user_id,
        room_id=room_id,
        entity_count=0,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    return doc


async def get_document(doc_id: int, room_id: int, db: AsyncSession) -> Document | None:
    """Get a document by its ID."""
    result = await db.execute(select(Document).where(Document.id == doc_id).where(Document.room_id == room_id))
    return result.scalars().first()


async def list_documents(
    user_id: int, room_id: int, db: AsyncSession, limit: int = 20, offset: int = 0
) -> tuple:
    """List documents for a user. Returns (items, total)."""
    # Get total count
    count_result = await db.execute(
        select(func.count(Document.id)).where(Document.room_id == room_id)
    )
    total = count_result.scalar() or 0

    # Get items
    result = await db.execute(
        select(Document)
        .where(Document.room_id == room_id)
        .order_by(Document.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()

    return list(items), total


async def update_document_status(
    doc_id: int, status: str, room_id: int, db: AsyncSession, entity_count: int = None, progress: int = None
):
    """Update the status (and optionally entity_count/progress) of a document."""
    result = await db.execute(select(Document).where(Document.id == doc_id).where(Document.room_id == room_id))
    doc = result.scalars().first()
    if doc:
        doc.status = status
        if entity_count is not None:
            doc.entity_count = entity_count
        if progress is not None:
            doc.progress = progress
        await db.flush()

async def bulk_import_documents(
    file: UploadFile, user_id: int, room_id: int, db: AsyncSession
) -> dict:
    """Bulk import structured data (JSON, CSV) as knowledge."""
    import json
    import csv
    from io import StringIO
    from app.services.entity_service import create_entity
    
    # Validate file
    ext = await validate_file_upload(file, ALLOWED_IMPORT_EXTENSIONS)
    
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    content_bytes = bytearray()
    while chunk := await file.read(1024 * 1024):
        content_bytes.extend(chunk)
        if len(content_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File too large. Maximum allowed size is 50MB."
            )
    content = bytes(content_bytes)
    
    errors = []
    imported_entities = 0
    
    try:
        if ext == ".json":
            data = json.loads(content.decode("utf-8"))
            if not isinstance(data, list):
                errors.append("JSON file must contain a list of entities.")
            else:
                for idx, row in enumerate(data):
                    try:
                        create_entity(
                            room_id=room_id,
                            name=row.get("name", f"Unnamed_{idx}"),
                            type=row.get("type", "Unknown"),
                            description=row.get("description", ""),
                            properties=row.get("properties", {}),
                            confidence_score=row.get("confidence_score", 1.0)
                        )
                        imported_entities += 1
                    except Exception as e:
                        errors.append(f"Row {idx} failed: {str(e)}")
        elif ext == ".csv":
            text_content = content.decode("utf-8")
            reader = csv.DictReader(StringIO(text_content))
            for idx, row in enumerate(reader):
                try:
                    create_entity(
                        room_id=room_id,
                        name=row.get("name", f"Unnamed_{idx}"),
                        type=row.get("type", "Unknown"),
                        description=row.get("description", ""),
                    )
                    imported_entities += 1
                except Exception as e:
                    errors.append(f"Row {idx} failed: {str(e)}")
        else:
            errors.append("Unsupported file type. Use .json or .csv.")
            
        if len(errors) > 0 and imported_entities == 0:
            # Complete failure, could implement a Neo4j transaction rollback if driver supported it in the loop
            pass
            
    except Exception as e:
        errors.append(f"Failed to parse file: {str(e)}")
        
    return {
        "success": len(errors) == 0,
        "imported_count": imported_entities,
        "errors": errors
    }
