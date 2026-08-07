"""Stable backend facade for the published agent layer.

The published implementation lives in ``ai-agent/``. Keeping this small
facade means the backend can continue importing ``agent.service`` while the
agent implementation remains independently replaceable.
"""

from __future__ import annotations

import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType
from typing import Any

_AGENT_ROOT = Path(__file__).resolve().parents[1] / "ai-agent"
_SERVICE_PATH = _AGENT_ROOT / "agent" / "service.py"
_MODULE_NAME = "_grant_platform_published_agent_service"


def _published_service() -> ModuleType:
    """Load the sibling agent package without duplicating its implementation."""
    loaded = sys.modules.get(_MODULE_NAME)
    if loaded is not None:
        return loaded

    if not _SERVICE_PATH.is_file():
        raise ModuleNotFoundError(
            "The published agent layer is missing ai-agent/agent/service.py."
        )

    # The published service imports its tools as ``tools.*``. Adding the
    # published layer root first makes those imports resolve to ai-agent/tools.
    agent_root = str(_AGENT_ROOT)
    if agent_root not in sys.path:
        sys.path.insert(0, agent_root)

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


def search_grants(profile: dict[str, Any], max_grants: int = 3) -> list[dict[str, Any]]:
    """Search live EU calls and rank them against the submitted profile."""
    return _published_service().search_grants(profile, max_grants=max_grants)


def start_application(grant: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    """Draft a complete application with the published agent layer."""
    return _published_service().start_application(grant, profile)


def rewrite_section(
    section_title: str,
    current_content: str,
    profile: dict[str, Any],
    grant: dict[str, Any] | None = None,
    instruction: str | None = None,
) -> str:
    """Rewrite one application section with the published agent layer."""
    return _published_service().rewrite_section(
        section_title=section_title,
        current_content=current_content,
        profile=profile,
        grant=grant,
        instruction=instruction,
    )
