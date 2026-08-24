from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ThinkingEventType(StrEnum):
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    PROGRESS = "progress"
    RESULT = "result"
    ERROR = "error"


class ThinkingStage(StrEnum):
    KEYWORDS = "keywords"
    SEARCH = "search"
    SELECT = "select"
    DRAFT = "draft"
    REWRITE = "rewrite"


class ThinkingEvent(BaseModel):
    event: ThinkingEventType = Field(description="Event type indicating status or event class.")
    stage: ThinkingStage = Field(description="Current agent execution stage.")
    message: str = Field(description="Human-readable description of the current action.")
    data: dict[str, Any] | None = Field(default=None, description="Optional payload or intermediate step metadata.")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat(),
        description="ISO 8601 UTC timestamp of the event.",
    )
