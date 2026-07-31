from __future__ import annotations

import os
from importlib import import_module
from typing import Any, Callable


class AgentUnavailableError(RuntimeError):
    pass


class AgentService:
    def __init__(self) -> None:
        os.environ.setdefault("CLAUDE_CODE_USE_BEDROCK", "1")
        os.environ.setdefault("AWS_REGION", "us-east-1")

    def search_grants(self, profile: dict[str, Any], max_grants: int = 3) -> list[dict[str, Any]]:
        search_grants = self._load_function("search_grants")
        return search_grants(profile, max_grants=max_grants)

    def start_application(
        self,
        grant: dict[str, Any],
        profile: dict[str, Any],
    ) -> dict[str, Any]:
        start_application = self._load_function("start_application")
        return start_application(grant, profile)

    def rewrite_section(
        self,
        section_title: str,
        current_content: str,
        profile: dict[str, Any],
        grant: dict[str, Any] | None = None,
        instruction: str | None = None,
    ) -> str:
        rewrite_section = self._load_function("rewrite_section")
        return rewrite_section(
            section_title,
            current_content,
            profile,
            grant=grant,
            instruction=instruction,
        )

    def _load_function(self, name: str) -> Callable[..., Any]:
        try:
            module = import_module("agent.service")
        except ModuleNotFoundError as exc:
            if exc.name not in {"agent", "agent.service"}:
                raise AgentUnavailableError(
                    f"The agent library could not import dependency `{exc.name}`."
                ) from exc
            raise AgentUnavailableError(
                "The agent library is not installed yet. Put it at "
                "`Grant-Intelligence-Platform/agent/` with `agent/service.py`."
            ) from exc

        try:
            function = getattr(module, name)
        except AttributeError as exc:
            raise AgentUnavailableError(
                f"The agent library is missing `agent.service.{name}`."
            ) from exc

        return function

