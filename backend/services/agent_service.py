import os
from collections.abc import Callable, Iterator
from importlib import import_module
from typing import Any

from backend.core.logging import get_logger

logger = get_logger("services.agent")


class AgentUnavailableError(RuntimeError):
    pass


class AgentService:
    def __init__(self) -> None:
        os.environ.setdefault("CLAUDE_CODE_USE_BEDROCK", "1")
        os.environ.setdefault("AWS_REGION", "us-east-1")
        self._cached_functions: dict[str, Callable[..., Any]] = {}

    def search_grants(
        self,
        profile: dict[str, Any],
        max_grants: int = 3,
        excluded_grant_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        search_grants = self._load_function("search_grants")
        result: list[dict[str, Any]] = search_grants(
            profile,
            max_grants=max_grants,
            excluded_grant_ids=excluded_grant_ids,
        )
        return result

    def search_grants_stream(
        self,
        profile: dict[str, Any],
        max_grants: int = 3,
        excluded_grant_ids: list[str] | None = None,
    ) -> Iterator[dict[str, Any]]:
        search_grants_stream = self._load_function("search_grants_stream")
        yield from search_grants_stream(
            profile,
            max_grants=max_grants,
            excluded_grant_ids=excluded_grant_ids,
        )

    def start_application(
        self,
        grant: dict[str, Any],
        profile: dict[str, Any],
        custom_instructions: str | None = None,
        template_type: str | None = None,
        attachments: str = "",
    ) -> dict[str, Any]:
        start_application = self._load_function("start_application")
        result: dict[str, Any] = start_application(
            grant,
            profile,
            custom_instructions=custom_instructions,
            template_type=template_type,
            attachments=attachments,
        )
        return result

    def start_application_stream(
        self,
        grant: dict[str, Any],
        profile: dict[str, Any],
        custom_instructions: str | None = None,
        template_type: str | None = None,
        attachments: str = "",
    ) -> Iterator[dict[str, Any]]:
        start_application_stream = self._load_function("start_application_stream")
        yield from start_application_stream(
            grant,
            profile,
            custom_instructions=custom_instructions,
            template_type=template_type,
            attachments=attachments,
        )

    def rewrite_section(
        self,
        section_title: str,
        current_content: str,
        profile: dict[str, Any],
        grant: dict[str, Any] | None = None,
        instruction: str | None = None,
    ) -> str:
        rewrite_section = self._load_function("rewrite_section")
        result: str = rewrite_section(
            section_title,
            current_content,
            profile,
            grant=grant,
            instruction=instruction,
        )
        return result

    def rewrite_section_stream(
        self,
        section_title: str,
        current_content: str,
        profile: dict[str, Any],
        grant: dict[str, Any] | None = None,
        instruction: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        rewrite_section_stream = self._load_function("rewrite_section_stream")
        yield from rewrite_section_stream(
            section_title,
            current_content,
            profile,
            grant=grant,
            instruction=instruction,
        )

    def document_qa(
        self,
        question: str,
        document: dict[str, Any],
        grant: dict[str, Any] | None = None,
        profile: dict[str, Any] | None = None,
        section_id: str | None = None,
        attachments: str = "",
    ) -> dict[str, Any]:
        document_qa = self._load_function("document_qa")
        result: dict[str, Any] = document_qa(
            question,
            document,
            grant=grant,
            profile=profile,
            section_id=section_id,
            attachments=attachments,
        )
        return result

    def document_qa_stream(
        self,
        question: str,
        document: dict[str, Any],
        grant: dict[str, Any] | None = None,
        profile: dict[str, Any] | None = None,
        section_id: str | None = None,
        attachments: str = "",
    ) -> Iterator[dict[str, Any]]:
        document_qa_stream = self._load_function("document_qa_stream")
        yield from document_qa_stream(
            question,
            document,
            grant=grant,
            profile=profile,
            section_id=section_id,
            attachments=attachments,
        )

    def _load_function(self, name: str) -> Callable[..., Any]:
        if name in self._cached_functions:
            return self._cached_functions[name]

        try:
            module = import_module("agent.service")
        except ModuleNotFoundError as exc:
            logger.warning("Agent module not found when loading '%s': %s", name, exc)
            if exc.name not in {"agent", "agent.service"}:
                raise AgentUnavailableError(f"The agent library could not import dependency `{exc.name}`.") from exc
            raise AgentUnavailableError("The agent library is not installed yet. Put it at `Grant-Intelligence-Platform/ai-agent/agent/service.py`.") from exc

        try:
            function = getattr(module, name)
            self._cached_functions[name] = function
        except AttributeError as exc:
            logger.warning("Agent function '%s' missing from module: %s", name, exc)
            raise AgentUnavailableError(f"The agent library is missing `agent.service.{name}`.") from exc

        callable_function: Callable[..., Any] = self._cached_functions[name]
        return callable_function
