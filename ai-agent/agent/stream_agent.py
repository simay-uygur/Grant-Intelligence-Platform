# agent/stream_agent.py
# Legacy compatibility wrapper for agent streaming functions.
# All primary streaming implementations are exported from agent.sdk_agent.

from collections.abc import Generator
from typing import Any

from tools.eu_horizon_api import eu_horizon_api
from tools.web_search import web_search_funding_opportunities

try:
    import agent.sdk_agent as _sdk_agent_mod

    from .sdk_agent import (
        rewrite_section_stream,
        run_agent_stream,
        start_application_stream,
    )
except ImportError:
    import agent.sdk_agent as _sdk_agent_mod
    from agent.sdk_agent import (
        rewrite_section_stream,
        run_agent_stream,
        start_application_stream,
    )


def _search_candidates_step(
    keywords: list[str],
    profile: dict[str, Any] | None = None,
) -> Generator[dict[str, Any], None, list[dict[str, Any]]]:
    # Sync mock patches on stream_agent to sdk_agent for legacy tests
    orig_eu = getattr(_sdk_agent_mod, "eu_horizon_api", None)
    orig_web = getattr(_sdk_agent_mod, "web_search_funding_opportunities", None)
    try:
        _sdk_agent_mod.eu_horizon_api = globals()["eu_horizon_api"]
        _sdk_agent_mod.web_search_funding_opportunities = globals()["web_search_funding_opportunities"]
        return (yield from _sdk_agent_mod._search_candidates_step(keywords, profile=profile))
    finally:
        if orig_eu is not None:
            _sdk_agent_mod.eu_horizon_api = orig_eu
        if orig_web is not None:
            _sdk_agent_mod.web_search_funding_opportunities = orig_web


__all__ = [
    "_search_candidates_step",
    "eu_horizon_api",
    "rewrite_section_stream",
    "run_agent_stream",
    "start_application_stream",
    "web_search_funding_opportunities",
]
