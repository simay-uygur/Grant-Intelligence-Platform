"""Stable backend facade for the published agent layer.

The published implementation lives in ``ai-agent/``. Keeping this small
facade means the backend can continue importing ``agent.service`` while the
agent implementation remains independently replaceable.
"""

from __future__ import annotations

import sys
from collections.abc import Iterator
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType
from typing import Any, cast

_AGENT_ROOT = Path(__file__).resolve().parents[1] / "ai-agent"
_SERVICE_PATH = _AGENT_ROOT / "agent" / "service.py"
_MODULE_NAME = "_grant_platform_published_agent_service"


def _published_service() -> ModuleType:
    """Load the sibling agent package without duplicating its implementation."""
    loaded = sys.modules.get(_MODULE_NAME)
    if loaded is not None:
        return loaded

    if not _SERVICE_PATH.is_file():
        raise ModuleNotFoundError("The published agent layer is missing ai-agent/agent/service.py.")

    # The published service imports its tools as ``tools.*``. Adding the
    # published layer root first makes those imports resolve to ai-agent/tools.
    agent_root = str(_AGENT_ROOT)
    if agent_root not in sys.path:
        sys.path.insert(0, agent_root)

    import agent

    ai_agent_sub = str(_AGENT_ROOT / "agent")
    if ai_agent_sub not in agent.__path__:
        agent.__path__.append(ai_agent_sub)

    spec = spec_from_file_location(_MODULE_NAME, _SERVICE_PATH)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load the agent service at {_SERVICE_PATH}.")

    module = module_from_spec(spec)
    sys.modules[_MODULE_NAME] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(_MODULE_NAME, None)
        raise
    return module


def search_grants(
    profile: dict[str, Any],
    user_request: str | None = None,
    conversation_history: list[dict[str, Any]] | None = None,
    max_grants: int = 3,
    excluded_grant_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Search live EU calls and rank them against the submitted profile."""
    return cast(
        list[dict[str, Any]],
        _published_service().search_grants(
            profile,
            user_request=user_request,
            conversation_history=conversation_history,
            max_grants=max_grants,
            excluded_grant_ids=excluded_grant_ids,
        ),
    )


def search_grants_stream(
    profile: dict[str, Any],
    max_grants: int = 3,
    excluded_grant_ids: list[str] | None = None,
) -> Iterator[dict[str, Any]]:
    """Stream events while searching live EU calls and ranking them."""
    yield from _published_service().search_grants_stream(
        profile,
        max_grants=max_grants,
        excluded_grant_ids=excluded_grant_ids,
    )


def generate_outline(
    grant: dict[str, Any],
    profile: dict[str, Any],
    template_type: str | None = None,
    custom_instructions: str | None = None,
    attachments: str = "",
) -> list[dict[str, Any]]:
    """Generate adaptive proposal outline with the published agent layer."""
    return cast(
        list[dict[str, Any]],
        _published_service().generate_outline(
            grant,
            profile,
            template_type=template_type,
            custom_instructions=custom_instructions,
            attachments=attachments,
        ),
    )


def start_application(
    grant: dict[str, Any],
    profile: dict[str, Any],
    custom_instructions: str | None = None,
    template_type: str | None = None,
    attachments: str = "",
    custom_sections: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Draft a complete application with the published agent layer."""
    return cast(
        dict[str, Any],
        _published_service().start_application(
            grant,
            profile,
            custom_instructions=custom_instructions,
            template_type=template_type,
            attachments=attachments,
            custom_sections=custom_sections,
        ),
    )


def start_application_stream(
    grant: dict[str, Any],
    profile: dict[str, Any],
    custom_instructions: str | None = None,
    template_type: str | None = None,
    attachments: str = "",
    custom_sections: list[dict[str, Any]] | None = None,
) -> Iterator[dict[str, Any]]:
    """Stream events while drafting a complete application."""
    yield from _published_service().start_application_stream(
        grant,
        profile,
        custom_instructions=custom_instructions,
        template_type=template_type,
        attachments=attachments,
        custom_sections=custom_sections,
    )


def rewrite_section(
    section_title: str,
    current_content: str,
    profile: dict[str, Any],
    grant: dict[str, Any] | None = None,
    instruction: str | None = None,
) -> str:
    """Rewrite one application section with the published agent layer."""
    return cast(
        str,
        _published_service().rewrite_section(
            section_title=section_title,
            current_content=current_content,
            profile=profile,
            grant=grant,
            instruction=instruction,
        ),
    )


def rewrite_section_stream(
    section_title: str,
    current_content: str,
    profile: dict[str, Any],
    grant: dict[str, Any] | None = None,
    instruction: str | None = None,
) -> Iterator[dict[str, Any]]:
    """Stream events while rewriting one application section."""
    yield from _published_service().rewrite_section_stream(
        section_title=section_title,
        current_content=current_content,
        profile=profile,
        grant=grant,
        instruction=instruction,
    )


def document_qa(
    question: str,
    document: dict[str, Any],
    grant: dict[str, Any] | None = None,
    profile: dict[str, Any] | None = None,
    section_id: str | None = None,
    attachments: str = "",
) -> dict[str, Any]:
    """Q&A consultation on an application document."""
    return cast(
        dict[str, Any],
        _published_service().document_qa(
            question,
            document,
            grant=grant,
            profile=profile,
            section_id=section_id,
            attachments=attachments,
        ),
    )


def document_qa_stream(
    question: str,
    document: dict[str, Any],
    grant: dict[str, Any] | None = None,
    profile: dict[str, Any] | None = None,
    section_id: str | None = None,
    attachments: str = "",
) -> Iterator[dict[str, Any]]:
    """Stream events while doing document Q&A consultation."""
    yield from _published_service().document_qa_stream(
        question,
        document,
        grant=grant,
        profile=profile,
        section_id=section_id,
        attachments=attachments,
    )
