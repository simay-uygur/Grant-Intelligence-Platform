from __future__ import annotations

import sys
import types
from pathlib import Path

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from backend.api.routes import documents as document_routes
from backend.main import create_app
from backend.services.document_service import DocumentService


def _install_fake_agent() -> dict:
    calls: dict = {}
    agent_package = types.ModuleType("agent")
    service_module = types.ModuleType("agent.service")

    def search_grants(profile: dict, max_grants: int = 3) -> list[dict]:
        calls["search_grants"] = {
            "profile": profile,
            "max_grants": max_grants,
        }
        return [
            {
                "id": "HORIZON-FAKE-001",
                "programme": "Horizon Europe",
                "title": "Robotics Quality Inspection",
                "matchPercentage": 91,
                "fundingAmount": "500,000 - 1,000,000 EUR",
                "deadline": "2026-12-31",
                "eligibleCountries": ["Kosovo"],
                "organisationEligibility": "SMEs are eligible.",
                "fundingType": "Grant",
                "description": "Supports robotics quality inspection projects.",
                "whyItMatches": "Strong sector and project fit.",
                "matchReasons": ["Robotics", "AI"],
                "requirements": ["Consortium"],
                "tags": ["robotics", "AI"],
                "sourceUrl": "https://example.org/horizon/fake",
            }
        ]

    def start_application(grant: dict, profile: dict) -> dict:
        calls["start_application"] = {
            "grant": grant,
            "profile": profile,
        }
        return {
            "id": "doc-001",
            "grantId": grant["id"],
            "grantTitle": grant["title"],
            "sections": [
                {
                    "id": "summary",
                    "title": "Executive Summary",
                    "content": "Drafted content.",
                }
            ],
            "updatedAt": "2026-07-29T00:00:00Z",
        }

    def rewrite_section(
        section_title: str,
        current_content: str,
        profile: dict,
        grant: dict | None = None,
        instruction: str | None = None,
    ) -> str:
        calls["rewrite_section"] = {
            "section_title": section_title,
            "current_content": current_content,
            "profile": profile,
            "grant": grant,
            "instruction": instruction,
        }
        return "Rewritten content."

    service_module.search_grants = search_grants
    service_module.start_application = start_application
    service_module.rewrite_section = rewrite_section
    agent_package.service = service_module
    sys.modules["agent"] = agent_package
    sys.modules["agent.service"] = service_module
    return calls


def test_search_grants_calls_agent_service() -> None:
    calls = _install_fake_agent()
    client = TestClient(create_app())

    response = client.post(
        "/api/v1/grants/search",
        json={
            "organisationName": "VisionWorks Robotics",
            "organisationType": "SME",
            "sector": "robotics",
            "country": "Kosovo",
            "projectTitle": "AI Quality Inspection",
            "projectDescription": "AI-driven quality inspection across 3 EU factories.",
            "fundingAmount": "500,000 - 1,000,000 EUR",
            "projectDuration": "24 months",
            "limit": 3,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["grants"][0]["id"] == "HORIZON-FAKE-001"
    assert calls["search_grants"]["max_grants"] == 3
    assert calls["search_grants"]["profile"]["organisationName"] == "VisionWorks Robotics"


def test_start_application_and_rewrite_section_call_agent_service(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    calls = _install_fake_agent()
    monkeypatch.setattr(
        document_routes,
        "document_service",
        DocumentService(database_path=str(tmp_path / "agent_applications.db")),
    )
    client = TestClient(create_app())
    profile = {
        "organisationName": "VisionWorks Robotics",
        "organisationType": "SME",
        "sector": "robotics",
        "country": "Kosovo",
        "projectTitle": "AI Quality Inspection",
        "projectDescription": "AI-driven quality inspection across 3 EU factories.",
        "fundingAmount": "500,000 - 1,000,000 EUR",
        "projectDuration": "24 months",
    }
    grant = {
        "id": "HORIZON-FAKE-001",
        "programme": "Horizon Europe",
        "title": "Robotics Quality Inspection",
    }

    start_response = client.post(
        "/api/v1/grants/HORIZON-FAKE-001/start-application",
        json={
            "grant": grant,
            "profile": profile,
        },
    )

    assert start_response.status_code == 200
    assert start_response.json()["sections"][0]["title"] == "Executive Summary"
    assert calls["start_application"]["grant"]["id"] == "HORIZON-FAKE-001"

    rewrite_response = client.patch(
        "/api/v1/documents/doc-001/sections/summary",
        json={
            "sectionTitle": "Executive Summary",
            "currentContent": "Drafted content.",
            "profile": profile,
            "grant": grant,
            "instruction": "Make it more technical.",
        },
    )

    assert rewrite_response.status_code == 200
    assert rewrite_response.json()["content"] == "Rewritten content."
    assert calls["rewrite_section"]["instruction"] == "Make it more technical."
