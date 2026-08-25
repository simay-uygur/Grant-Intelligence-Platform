from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.api.dependencies import get_current_user
from backend.schemas.uploads import DocumentUploadResponse
from backend.services.upload_service import (
    UnsupportedUploadError,
    UploadTooLargeError,
    detect_content_type,
    extract_text,
)

router = APIRouter()


@router.post(
    "/documents/upload",
    response_model=DocumentUploadResponse,
    summary="Upload a supporting document",
    description=("Upload a PDF, Word (.docx), or text file; its text is extracted in memory and stored so drafting and Q&A prompts can reference the applicant's real background material."),
    response_description="Extracted-text summary for the uploaded file.",
)
async def upload_document(
    file: UploadFile = File(...),
    application_id: str | None = Form(default=None),
    conversation_id: str | None = Form(default=None),
    current_user: dict[str, str] | None = Depends(get_current_user),
) -> DocumentUploadResponse:
    from backend.api.routes.documents import document_service

    filename = file.filename or "upload.txt"
    content = await file.read()
    try:
        text = extract_text(filename, content)
    except (UnsupportedUploadError, UploadTooLargeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    record = document_service.save_upload(
        filename=filename,
        content_type=file.content_type or detect_content_type(filename),
        extracted_text=text,
        user_id=current_user["id"] if current_user else None,
        application_id=application_id,
        conversation_id=conversation_id,
    )
    return DocumentUploadResponse.model_validate(record)
