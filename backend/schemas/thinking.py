from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ThinkingEventType(str, Enum):
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    PROGRESS = "progress"
    RESULT = "result"
    ERROR = "error"


class ThinkingStage(str, Enum):
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
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of the event.",
    )
