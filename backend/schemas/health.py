from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(description="Current service status.", examples=["ok"])

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "ok",
            }
        }
    }
