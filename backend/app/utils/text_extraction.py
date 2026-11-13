"""Utilities for extracting text from uploaded files."""

import os


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file using PyPDF2."""
    try:
        from PyPDF2 import PdfReader

        reader = PdfReader(file_path)
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n".join(text_parts)
    except Exception as e:
        return f"[PDF extraction error: {str(e)}]"


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX file using python-docx."""
    try:
        from docx import Document

        doc = Document(file_path)
        text_parts = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)
        return "\n".join(text_parts)
    except Exception as e:
        return f"[DOCX extraction error: {str(e)}]"


def extract_text_from_txt(file_path: str) -> str:
    """Extract text from a plain text file."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        return f"[Text extraction error: {str(e)}]"


def extract_text(file_path: str, filename: str) -> str:
    """Dispatch text extraction based on file extension.

    Supports: .pdf, .docx, .txt, .md, .csv
    """
    ext = os.path.splitext(filename.lower())[1]

    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext == ".docx":
        return extract_text_from_docx(file_path)
    elif ext in (".txt", ".md", ".csv"):
        return extract_text_from_txt(file_path)
    else:
        return extract_text_from_txt(file_path)
