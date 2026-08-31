import json
import types

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from backend.main import create_app


def _install_fake_streaming_agent():
    agent_package = types.ModuleType("agent")
    service_module = types.ModuleType("agent.service")

    def search_grants(profile: dict, max_grants: int = 3, excluded_grant_ids: list[str] | None = None) -> list[dict]:
        return [
            {
                "id": "HORIZON-FAKE-001",
                "title": "Fake Grant",
                "programme": "Horizon Europe",
            }
        ]

    def search_grants_stream(profile: dict, max_grants: int = 3, excluded_grant_ids: list[str] | None = None):
        yield {
            "event": "thinking",
            "stage": "keywords",
            "message": "Generating search keywords...",
        }
        yield {
            "event": "progress",
            "stage": "keywords",
            "message": "Generated 2 keywords",
            "data": {"keywords": ["ai", "robotics"]},
        }
        yield {
            "event": "result",
            "stage": "select",
            "message": "Selected 1 grant",
            "data": {
                "grants": search_grants(profile, max_grants, excluded_grant_ids),
                "all_candidates": [
                    {
                        "id": "HORIZON-FAKE-001",
                        "title": "Fake Grant",
                        "programme": "Horizon Europe",
                    },
                    {
                        "id": "WEB-FAKE-001",
                        "title": "Fake Web Grant",
                        "programme": "Web Grant Discovery",
                    },
                ],
                "eu_count": 1,
                "web_count": 1,
            },
        }

    def start_application(grant: dict, profile: dict, custom_instructions=None, template_type=None, attachments="") -> dict:
        return {
            "id": "doc-fake-001",
            "grantId": grant.get("id", ""),
            "grantTitle": grant.get("title", ""),
            "sections": [{"id": "sec-1", "title": "Overview", "content": "Sample content"}],
            "updatedAt": "2026-08-16T12:00:00Z",
        }

    def start_application_stream(grant: dict, profile: dict, custom_instructions=None, template_type=None, attachments=""):
        yield {
            "event": "thinking",
            "stage": "draft",
            "message": "Drafting application...",
        }
        yield {
            "event": "result",
            "stage": "draft",
            "message": "Drafted document",
            "data": {"document": start_application(grant, profile)},
        }

    def rewrite_section(
        section_title: str,
        current_content: str,
        profile: dict,
        grant: dict | None = None,
        instruction: str | None = None,
    ) -> str:
        return f"Rewritten: {current_content}"

    def rewrite_section_stream(
        section_title: str,
        current_content: str,
        profile: dict,
        grant: dict | None = None,
        instruction: str | None = None,
    ):
        yield {
            "event": "thinking",
            "stage": "rewrite",
            "message": "Rewriting section...",
        }
        yield {
            "event": "result",
            "stage": "rewrite",
            "message": "Rewrote section",
            "data": {"content": rewrite_section(section_title, current_content, profile, grant, instruction)},
        }

    def document_qa(question: str, document: dict, grant: dict | None = None, profile: dict | None = None, section_id: str | None = None, attachments="") -> dict:
        return {
            "answer": f"Advice for question: {question}",
            "section_id": section_id,
            "suggestions": ["Improve consortium balance", "Clarify TRL readiness"],
        }

    def document_qa_stream(question: str, document: dict, grant: dict | None = None, profile: dict | None = None, section_id: str | None = None, attachments=""):
        yield {
            "event": "thinking",
            "stage": "qa",
            "message": "Consulting evaluator agent...",
        }
        yield {
            "event": "token_delta",
            "stage": "qa",
            "data": {"delta": "Advice chunk", "accumulated": f"Advice for question: {question}"},
        }
        yield {
            "event": "result",
            "stage": "qa",
            "data": document_qa(question, document, grant, profile, section_id),
        }

    service_module.search_grants = search_grants
    service_module.search_grants_stream = search_grants_stream
    service_module.start_application = start_application
    service_module.start_application_stream = start_application_stream
    service_module.rewrite_section = rewrite_section
    service_module.rewrite_section_stream = rewrite_section_stream
    service_module.document_qa = document_qa
    service_module.document_qa_stream = document_qa_stream

    agent_package.service = service_module
    return agent_package


def test_grant_search_stream(monkeypatch: MonkeyPatch):
    fake_agent = _install_fake_streaming_agent()
    monkeypatch.setitem(__import__("sys").modules, "agent", fake_agent)
    monkeypatch.setitem(__import__("sys").modules, "agent.service", fake_agent.service)

    client = TestClient(create_app())
    response = client.post(
        "/api/v1/grants/search/stream",
        json={"sector": "robotics", "country": "Kosovo"},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    lines = [line.strip() for line in response.text.split("\n") if line.startswith("data:")]
    assert len(lines) == 3

    event0 = json.loads(lines[0].replace("data: ", ""))
    assert event0["event"] == "thinking"
    assert event0["stage"] == "keywords"

    event2 = json.loads(lines[2].replace("data: ", ""))
    assert event2["event"] == "result"
    assert "grants" in event2["data"]
    assert event2["data"]["grants"][0]["id"] == "HORIZON-FAKE-001"
    assert len(event2["data"]["all_candidates"]) == 2
    assert event2["data"]["eu_count"] == 1
    assert event2["data"]["web_count"] == 1


def test_start_application_stream(monkeypatch: MonkeyPatch):
    fake_agent = _install_fake_streaming_agent()
    monkeypatch.setitem(__import__("sys").modules, "agent", fake_agent)
    monkeypatch.setitem(__import__("sys").modules, "agent.service", fake_agent.service)

    client = TestClient(create_app())
    payload = {
        "grant": {
            "id": "HORIZON-FAKE-001",
            "title": "Fake Grant",
        },
        "profile": {"sector": "robotics"},
    }
    response = client.post(
        "/api/v1/grants/HORIZON-FAKE-001/start-application/stream",
        json=payload,
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    lines = [line.strip() for line in response.text.split("\n") if line.startswith("data:")]
    assert len(lines) == 2

    event1 = json.loads(lines[1].replace("data: ", ""))
    assert event1["event"] == "result"
    assert event1["data"]["document"]["id"] == "doc-fake-001"


def test_rewrite_section_stream(monkeypatch: MonkeyPatch):
    fake_agent = _install_fake_streaming_agent()
    monkeypatch.setitem(__import__("sys").modules, "agent", fake_agent)
    monkeypatch.setitem(__import__("sys").modules, "agent.service", fake_agent.service)

    client = TestClient(create_app())
    payload = {
        "sectionTitle": "Overview",
        "currentContent": "Original content",
        "profile": {"sector": "robotics"},
    }
    response = client.patch(
        "/api/v1/documents/doc-fake-001/sections/sec-1/stream",
        json=payload,
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    lines = [line.strip() for line in response.text.split("\n") if line.startswith("data:")]
    assert len(lines) == 2

    event1 = json.loads(lines[1].replace("data: ", ""))
    assert event1["event"] == "result"
    assert event1["data"]["content"] == "Rewritten: Original content"


def test_document_qa_stream(monkeypatch: MonkeyPatch):
    fake_agent = _install_fake_streaming_agent()
    monkeypatch.setitem(__import__("sys").modules, "agent", fake_agent)
    monkeypatch.setitem(__import__("sys").modules, "agent.service", fake_agent.service)

    client = TestClient(create_app())
    payload = {
        "question": "Is this proposal strong enough?",
        "sectionId": "sec-1",
        "document": {
            "id": "doc-fake-001",
            "grantId": "HORIZON-FAKE-001",
            "grantTitle": "Fake Grant",
            "sections": [{"id": "sec-1", "title": "Overview", "content": "Sample content"}],
            "updatedAt": "2026-08-16T12:00:00Z",
        },
        "grant": {"id": "HORIZON-FAKE-001", "title": "Fake Grant"},
        "profile": {"sector": "robotics"},
    }
    response = client.post(
        "/api/v1/documents/doc-fake-001/qa/stream",
        json=payload,
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    lines = [line.strip() for line in response.text.split("\n") if line.startswith("data:")]
    assert len(lines) == 3

    event0 = json.loads(lines[0].replace("data: ", ""))
    assert event0["event"] == "thinking"
    assert event0["stage"] == "qa"

    event2 = json.loads(lines[2].replace("data: ", ""))
    assert event2["event"] == "result"
    assert "answer" in event2["data"]
    assert "suggestions" in event2["data"]
    assert event2["data"]["suggestions"] == ["Improve consortium balance", "Clarify TRL readiness"]
