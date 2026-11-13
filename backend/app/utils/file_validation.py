"""File upload validation utility.

Ensures strict file typing by validating extensions against expected MIME types
and optionally checking the underlying binary magic signatures to prevent spoofing.
"""

import os
import filetype
from fastapi import UploadFile, HTTPException, status

ALLOWED_DOC_EXTENSIONS = {
    ".pdf": ["application/pdf"],
    ".txt": ["text/plain"],
    ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
    ".doc": ["application/msword"],
    ".csv": ["text/csv", "application/csv", "text/x-csv", "application/vnd.ms-excel", "text/plain"],
    ".json": ["application/json", "text/json", "text/plain"],
}

ALLOWED_IMPORT_EXTENSIONS = {
    ".json": ["application/json", "text/json", "text/plain"],
    ".csv": ["text/csv", "application/csv", "text/x-csv", "application/vnd.ms-excel", "text/plain"],
}

ALLOWED_CHAT_EXTENSIONS = {
    # Images
    ".png": ["image/png"],
    ".jpg": ["image/jpeg", "image/jpg"],
    ".jpeg": ["image/jpeg", "image/jpg"],
    ".gif": ["image/gif"],
    ".webp": ["image/webp"],
    # Audio/Video
    ".webm": ["audio/webm", "video/webm"],
    ".mp3": ["audio/mpeg", "audio/mp3"],
    ".wav": ["audio/wav", "audio/x-wav"],
    ".ogg": ["audio/ogg", "application/ogg"],
    ".m4a": ["audio/x-m4a", "audio/mp4", "audio/m4a"],
    # Documents
    **ALLOWED_DOC_EXTENSIONS
}

async def validate_file_upload(file: UploadFile, allowed_extensions: dict, fallback_ext: str = None) -> str:
    """Validate an uploaded file's extension, mime type, and magic bytes signature.
    
    Returns the validated extension.
    """
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    
    # Handle missing extension but known mime (e.g., chat voice notes)
    if not ext and fallback_ext:
        ext = fallback_ext.lower()
        
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' is not allowed."
        )
        
    allowed_mimes = allowed_extensions[ext]
    
    # Validate HTTP content-type header
    if file.content_type and file.content_type.lower() not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MIME type '{file.content_type}' does not match allowed types for extension '{ext}'."
        )

    # Validate file magic bytes signature
    try:
        header = await file.read(2048)
        await file.seek(0)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file content: {str(e)}"
        )
        
    guess = filetype.guess(header)
    if guess is not None:
        guessed_mime = guess.mime.lower()
        if guessed_mime not in allowed_mimes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File signature '{guessed_mime}' does not match expected format for extension '{ext}'."
            )
            
    return ext
