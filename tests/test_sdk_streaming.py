from unittest.mock import patch

from agent.sdk_agent import (
    _fallback_final_grants,
    rewrite_section_stream,
    run_agent_stream,
    start_application_stream,
)


def test_sdk_agent_search_stream_emits_stages_and_counts():
    fake_eu_results = [
        {
            "identifier": "HORIZON-TEST-001",
            "title": "Robotics in Agriculture",
            "programme": "Horizon Europe",
            "deadline": "2027-10-15",
            "sourceUrl": "https://ec.europa.eu/horizon/test1",
        }
    ]
    fake_web_results = [
        {
            "identifier": "web-test-001",
            "title": "National AgriTech Grant",
            "programme": "Web Grant Discovery",
            "deadline": "2027-11-01",
            "source": "Web Search",
            "sourceUrl": "https://agri.example.org",
        }
    ]

    with (
        patch("agent.sdk_agent.eu_horizon_api", return_value=fake_eu_results),
        patch("agent.sdk_agent.web_search_funding_opportunities", return_value=fake_web_results),
    ):
        profile = {
            "organisationName": "AgriBotics",
            "sector": "robotics",
            "country": "Germany",
        }

        events = list(run_agent_stream(profile, max_grants=2))

        stages = [e.get("stage") for e in events]
        assert "keywords" in stages
        assert "search" in stages
        assert "select" in stages

        search_progress = [e for e in events if e.get("stage") == "search" and e.get("event") == "progress"]
        assert len(search_progress) >= 2
        # Check that eu_count and web_count are present in progress data
        latest_search = search_progress[-1]
        assert "eu_count" in latest_search["data"]
        assert "web_count" in latest_search["data"]

        result_event = next(e for e in events if e.get("event") == "result")
        assert result_event["stage"] == "select"
        data = result_event["data"]
        assert "grants" in data
        assert "all_candidates" in data
        assert data["eu_count"] >= 1
        assert data["web_count"] >= 1


def test_sdk_agent_exclusion_in_stream():
    fake_eu_results = [
        {
            "identifier": "HORIZON-EXCLUDE-ME",
            "title": "Exclude This Grant",
            "programme": "Horizon Europe",
            "deadline": "2027-10-15",
            "sourceUrl": "https://ec.europa.eu/horizon/exclude",
        },
        {
            "identifier": "HORIZON-KEEP-ME",
            "title": "Keep This Grant",
            "programme": "Horizon Europe",
            "deadline": "2027-10-15",
            "sourceUrl": "https://ec.europa.eu/horizon/keep",
        },
    ]

    with (
        patch("agent.sdk_agent.eu_horizon_api", return_value=fake_eu_results),
        patch("agent.sdk_agent.web_search_funding_opportunities", return_value=[]),
    ):
        profile = {"organisationName": "Test Org", "sector": "ai"}
        events = list(run_agent_stream(profile, max_grants=2, excluded_grant_ids=["HORIZON-EXCLUDE-ME"]))

        result_event = next(e for e in events if e.get("event") == "result")
        granted_ids = [g["id"] for g in result_event["data"]["grants"]]
        assert "HORIZON-EXCLUDE-ME" not in granted_ids


def test_sdk_agent_start_application_stream():
    grant = {
        "id": "HORIZON-DRAFT-01",
        "title": "Autonomous Farming",
        "programme": "Horizon Europe",
        "sourceUrl": "https://ec.europa.eu/horizon/draft01",
    }
    profile = {"organisationName": "FarmTech"}

    with patch("agent.sdk_agent.draft_single_section_stream", return_value=["Section text content chunk"]):
        events = list(
            start_application_stream(
                grant=grant,
                profile=profile,
                custom_sections=[("sec-1", "Project Summary")],
            )
        )

        event_types = [e.get("event") for e in events]
        assert "thinking" in event_types
        assert "section_chunk" in event_types
        assert "progress" in event_types
        assert "result" in event_types

        result = next(e for e in events if e.get("event") == "result")
        doc = result["data"]["document"]
        assert doc["grantId"] == "HORIZON-DRAFT-01"
        assert len(doc["sections"]) == 1
        assert doc["sections"][0]["content"] == "Section text content chunk"


def test_sdk_agent_rewrite_section_stream():
    profile = {"organisationName": "FarmTech"}

    with patch("agent.sdk_agent._tool_rewrite_stream", return_value=["Rewritten chunk 1 ", "and chunk 2"]):
        events = list(
            rewrite_section_stream(
                section_title="Objectives",
                current_content="Initial objectives",
                profile=profile,
            )
        )

        event_types = [e.get("event") for e in events]
        assert "thinking" in event_types
        assert "tool_call" in event_types
        assert "section_chunk" in event_types
        assert "result" in event_types

        result = next(e for e in events if e.get("event") == "result")
        assert result["data"]["content"] == "Rewritten chunk 1 and chunk 2"


def test_fallback_final_grants_excludes_without_source_url():
    candidates = [
        {
            "id": "test-1",
            "title": "Test Grant 1",
            "programme": "Horizon Europe",
            "source": "EU Horizon API",
            "deadline": "2027-12-31",
        },
        {
            "id": "test-2",
            "title": "Test Grant 2",
            "programme": "Horizon Europe",
            "source": "EU Horizon API",
            "deadline": "2027-12-31",
            "sourceUrl": "https://example.com/test2",
        },
    ]
    profile = {"organisationName": "Test", "sector": "ai"}
    result = _fallback_final_grants(candidates, profile, max_grants=2)
    assert len(result) == 1, f"Expected 1 grant (only the one with sourceUrl), got {len(result)}"
    assert result[0]["id"] == "test-2"


def test_fallback_final_grants_excludes_expired_deadline():
    candidates = [
        {
            "id": "test-3",
            "title": "Expired Grant",
            "programme": "Horizon Europe",
            "source": "EU Horizon API",
            "deadline": "2020-01-01",
            "sourceUrl": "https://example.com",
        },
        {
            "id": "test-4",
            "title": "Valid Grant",
            "programme": "Horizon Europe",
            "source": "EU Horizon API",
            "deadline": "2027-12-31",
            "sourceUrl": "https://example.com/valid",
        },
    ]
    profile = {"organisationName": "Test", "sector": "ai"}
    result = _fallback_final_grants(candidates, profile, max_grants=2)
    assert len(result) == 1, f"Expected 1 grant (only the valid one), got {len(result)}"
    assert result[0]["id"] == "test-4"


def test_fallback_final_grants_excludes_by_id():
    candidates = [
        {
            "id": "EXCLUDE-THIS",
            "title": "Excluded Grant",
            "programme": "Horizon Europe",
            "source": "EU Horizon API",
            "deadline": "2027-12-31",
            "sourceUrl": "https://example.com",
        },
        {
            "id": "KEEP-THIS",
            "title": "Keep This Grant",
            "programme": "Horizon Europe",
            "source": "EU Horizon API",
            "deadline": "2027-12-31",
            "sourceUrl": "https://example.com",
        },
    ]
    profile = {"organisationName": "Test", "sector": "ai"}
    result = _fallback_final_grants(candidates, profile, max_grants=2, excluded_grant_ids=["EXCLUDE-THIS"])
    excluded_ids = [g.get("id") for g in result]
    assert "EXCLUDE-THIS" not in excluded_ids, "EXCLUDE-THIS should be excluded"
    assert "KEEP-THIS" in excluded_ids, "KEEP-THIS should be returned"


def test_fallback_final_grants_ranks_by_score():
    candidates = [
        {
            "id": "low-match",
            "title": "Low Match Grant",
            "programme": "Horizon Europe",
            "source": "EU Horizon API",
            "deadline": "2027-12-31",
            "sourceUrl": "https://example.com",
        },
        {
            "id": "high-match",
            "title": "Artificial Intelligence Research",
            "programme": "Horizon Europe",
            "source": "EU Horizon API",
            "deadline": "2027-12-31",
            "sourceUrl": "https://example.com",
        },
    ]
    profile = {"organisationName": "Test", "sector": "ai"}
    result = _fallback_final_grants(candidates, profile, max_grants=2)
    assert len(result) == 2, f"Expected 2 grants, got {len(result)}"
    assert result[0]["matchPercentage"] >= result[1]["matchPercentage"], "Should be ranked by score"
