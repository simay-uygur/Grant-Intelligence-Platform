"""Grant agent adapter used by the backend."""

import sys
from pathlib import Path

_ai_agent_root = Path(__file__).resolve().parent.parent / "ai-agent"
_ai_agent_sub = _ai_agent_root / "agent"
if _ai_agent_sub.is_dir() and str(_ai_agent_sub) not in __path__:
    __path__.append(str(_ai_agent_sub))
if _ai_agent_root.is_dir() and str(_ai_agent_root) not in sys.path:
    sys.path.insert(0, str(_ai_agent_root))
