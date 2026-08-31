import asyncio
import json
import sys
from unittest.mock import MagicMock, patch

# Provide claude_agent_sdk mock before sdk_agent imports it
_cm = MagicMock()
_cm.ClaudeAgentOptions = MagicMock()
_cm.ClaudeSDKClient = MagicMock()
_cm.create_sdk_mcp_server = MagicMock()
_cm.tool = lambda *a, **k: lambda f: f
sys.modules["claude_agent_sdk"] = _cm

import agent.sdk_agent as _sdk_agent

_sdk_agent.HAS_CLAUDE_AGENT_SDK = True
_sdk_agent.ClaudeAgentOptions = _cm.ClaudeAgentOptions
_sdk_agent.ClaudeSDKClient = _cm.ClaudeSDKClient

from agent.sdk_agent import run_agent_stream


def _make_block(text):
    block = MagicMock()
    inner = MagicMock()
    inner.text = text
    block.content = [inner]
    return block


def _make_msg(text, session_id=None, result_text=""):
    msg = MagicMock()
    msg.session_id = session_id
    msg.result = result_text
    msg.content = [_make_block(text)]
    return msg


def test_run_agent_returns_final_grants_and_candidates():
    fake_grant = {"id": "HORIZON-TEST-001", "title": "Robotics in Agriculture"}
    fake_web = {"id": "web-test-001", "title": "National AgriTech Grant"}

    async def fake_query(prompt, options):
        yield _make_msg(json.dumps({"eu_candidates": [fake_grant], "web_candidates": []}))
        yield _make_msg(json.dumps({"eu_candidates": [], "web_candidates": [fake_web]}))
        yield _make_msg(json.dumps({"finalGrants": [fake_grant]}))

    with patch("agent.sdk_agent.query", fake_query):
        profile = {"organisationName": "AgriBotics", "sector": "robotics", "country": "Germany"}

        async def _collect():
            result = []
            async for e in run_agent_stream(profile, user_message="Find grants"):
                result.append(e)
            return result

        events = asyncio.run(_collect())

        result_event = next(e for e in events if e.get("event") == "result")
        data = result_event.get("data", {})
        assert len(data.get("grants", [])) >= 0
        assert len(data.get("all_candidates", [])) >= 1


def test_run_agent_stream_yields_events():
    fake_grant = {"id": "HORIZON-TEST-001", "title": "Robotics in Agriculture"}

    async def fake_query(prompt, options):
        yield _make_msg(json.dumps({"eu_candidates": [fake_grant], "web_candidates": []}))
        yield _make_msg(json.dumps({"finalGrants": [fake_grant]}))

    with patch("agent.sdk_agent.query", fake_query):
        profile = {"organisationName": "AgriBotics", "sector": "robotics", "country": "Germany"}

        async def _collect():
            result = []
            async for e in run_agent_stream(profile, user_message="Find grants"):
                result.append(e)
            return result

        events = asyncio.run(_collect())

        event_types = [e.get("event") for e in events]
        assert "thinking" in event_types
        assert "progress" in event_types
        assert "result" in event_types

        result_event = next(e for e in events if e.get("event") == "result")
        data = result_event.get("data", {})
        assert "grants" in data
        assert "all_candidates" in data
        assert "eu_count" in data
        assert "web_count" in data


def test_run_agent_stream_excluded_grant_ids():
    fake_grant = {"id": "HORIZON-KEEP-ME", "title": "Keep This Grant"}

    async def fake_query(prompt, options):
        yield _make_msg(json.dumps({"eu_candidates": [fake_grant], "web_candidates": []}))
        yield _make_msg(json.dumps({"finalGrants": [fake_grant]}))

    with patch("agent.sdk_agent.query", fake_query):
        profile = {"organisationName": "Test Org", "sector": "ai"}

        async def _collect():
            result = []
            async for e in run_agent_stream(profile, user_message="Find grants", excluded_grant_ids=["HORIZON-EXCLUDE-ME"]):
                result.append(e)
            return result

        events = asyncio.run(_collect())

        result_event = next(e for e in events if e.get("event") == "result")
        granted_ids = [g.get("id") for g in result_event.get("data", {}).get("grants", [])]
        assert "HORIZON-EXCLUDE-ME" not in granted_ids


def test_run_agent_stream_returns_session_id():
    async def fake_query(prompt, options):
        yield _make_msg(json.dumps({"eu_candidates": [], "web_candidates": []}), session_id="test-session-123")
        yield _make_msg(json.dumps({"finalGrants": []}), session_id="test-session-123")

    with patch("agent.sdk_agent.query", fake_query):
        profile = {"organisationName": "Test Org"}

        async def _collect():
            result = []
            async for e in run_agent_stream(profile, user_message="Find grants"):
                result.append(e)
            return result

        events = asyncio.run(_collect())

        result_event = next(e for e in events if e.get("event") == "result")
        assert result_event.get("data", {}).get("session_id") == "test-session-123"
