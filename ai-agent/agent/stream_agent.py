# agent/stream_agent.py
# Legacy compatibility wrapper for agent streaming functions.
# All primary streaming implementations are exported from agent.sdk_agent.

from collections.abc import Generator
from typing import Any

from tools.eu_horizon_api import eu_horizon_api
from tools.rewrite_section import rewrite_section_stream
from tools.start_application import start_application_stream
from tools.web_search import web_search as web_search_funding_opportunities

from agent.sdk_agent import run_agent_stream


def _search_candidates_step(
    keywords: list[str],
    profile: dict[str, Any] | None = None,
) -> Generator[dict[str, Any], None, list[dict[str, Any]]]:
    return []


__all__ = [
    "_search_candidates_step",
    "eu_horizon_api",
    "rewrite_section_stream",
    "run_agent_stream",
    "start_application_stream",
    "web_search_funding_opportunities",
]
