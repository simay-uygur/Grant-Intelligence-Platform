import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch

ai_agent_root = Path(__file__).resolve().parents[1] / "ai-agent"
if str(ai_agent_root) not in sys.path:
    sys.path.insert(0, str(ai_agent_root))

stream_agent_path = ai_agent_root / "agent" / "stream_agent.py"
spec = importlib.util.spec_from_file_location("stream_agent_test_module", stream_agent_path)
stream_agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stream_agent)

_search_candidates_step = stream_agent._search_candidates_step


def test_search_candidates_step_parallel_execution():
    fake_eu_results = [
        {
            "identifier": "HORIZON-CL4-2025-01",
            "title": "AI Robotics in Horizon",
            "programme": "Horizon Europe",
            "url": "https://ec.europa.eu/horizon/1",
        }
    ]
    fake_web_results = [
        {
            "identifier": "web-grant-innovate-001",
            "title": "National Robotics Innovation Grant",
            "programme": "Innovate UK Grant",
            "source": "Web Search",
            "url": "https://www.innovateuk.org/funding/robotics",
        }
    ]

    with (
        patch.object(stream_agent, "eu_horizon_api", return_value=fake_eu_results) as mock_eu,
        patch.object(stream_agent, "web_search_funding_opportunities", return_value=fake_web_results) as mock_web,
    ):
        gen = _search_candidates_step(["robotics"], profile={"country": "Germany"})
        events = []
        try:
            while True:
                events.append(next(gen))
        except StopIteration as stop:
            candidates = stop.value

        # Both tools should have been invoked
        assert mock_eu.called
        assert mock_web.called

        # We should have thinking and progress events
        assert any(e["event"] == "thinking" and e["stage"] == "search" for e in events)
        progress_events = [e for e in events if e["event"] == "progress" and e["stage"] == "search"]
        assert len(progress_events) >= 2

        # Verify candidate pool contains both EU and Web results
        assert len(candidates) == 2
        sources = {c.get("source") for c in candidates}
        assert "EU Horizon API" in sources
        assert "Web Search" in sources
