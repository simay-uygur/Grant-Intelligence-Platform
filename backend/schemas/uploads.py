from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    id: str = Field(description="Upload identifier used to reference the attachment later.")
    filename: str = Field(description="Original file name.")
    contentType: str = Field(description="Detected MIME content type.")
    characterCount: int = Field(ge=0, description="Number of extracted text characters stored.")
    textSnippet: str = Field(description="Preview of the extracted text (first ~500 characters).")
    applicationId: str | None = Field(default=None, description="Application the upload is associated with.")
    conversationId: str | None = Field(default=None, description="Chat conversation the upload belongs to.")
    uploadedAt: str = Field(description="Upload timestamp in ISO-8601 format.")
