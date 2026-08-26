from pathlib import Path

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from backend.api.routes import documents as document_routes
from backend.main import create_app
from backend.services.document_service import DocumentService

PROFILE = {
    "organisationName": "Northlight Robotics",
    "organisationType": "SME",
    "country": "Germany",
    "sector": "robotics",
    "projectTitle": "AI inspection",
}
GRANT = {
    "id": "HORIZON-SHEETS-001",
    "title": "Robotics Quality Inspection",
    "programme": "Horizon Europe",
    "fundingAmount": "EUR 500 000",
    "deadline": "2026-12-31",
}
GENERATED_SHEETS_JSON = """
{
  "workPackages": [
    {"number": "WP1", "title": "Requirements & pilots", "lead": "Northlight", "personMonths": 12,
     "startMonth": 1, "endMonth": 6, "deliverables": ["D1.1 Pilot report"]},
    {"number": "WP2", "title": "AI model development", "lead": "TUM", "personMonths": 20,
     "startMonth": 4, "endMonth": 24, "deliverables": ["D2.1 Model"]}
  ],
  "budget": {
    "items": [
      {"category": "Personnel", "description": "Engineers", "personMonths": 32, "directCost": 200000},
      {"category": "Equipment", "description": "Drone rigs", "directCost": 50000},
      {"category": "Subcontracting", "description": "Certification body", "directCost": 30000}
    ]
  },
  "risks": [
    {"id": "R1", "description": "Recruitment delays", "workPackage": "WP2",
     "likelihood": "medium", "severity": "high", "mitigation": "Early hiring + partners"}
  ],
  "consortium": [
    {"name": "Northlight Robotics", "country": "Germany", "type": "SME",
     "keyTasks": "Pilots and exploitation", "allocatedBudget": 180000},
    {"name": "TU Munich", "country": "Germany", "type": "University",
     "keyTasks": "AI research", "allocatedBudget": 100000}
  ]
}
"""


def _build_client(database_path: Path, monkeypatch: MonkeyPatch) -> TestClient:
    service = DocumentService(database_path=str(database_path))
    service.agent_service.start_application = lambda grant, profile, custom_instructions=None, template_type=None, attachments="": {
        "id": "doc-sheets-001",
        "grantId": grant["id"],
        "grantTitle": grant["title"],
        "sections": [{"id": "budget-overview", "title": "Budget Overview", "content": "Draft."}],
        "updatedAt": "2026-08-25T08:00:00Z",
    }
    monkeypatch.setattr(document_routes, "document_service", service)
    return TestClient(create_app())


def _start_application(client: TestClient, **extra) -> dict:
    response = client.post(
        "/api/v1/grants/HORIZON-SHEETS-001/start-application",
        json={"grant": GRANT, "profile": PROFILE, **extra},
    )
    assert response.status_code == 200
    return response.json()


def test_get_sheets_returns_empty_defaults(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "sheets_empty.db", monkeypatch)
    document = _start_application(client)

    response = client.get(f"/api/v1/documents/{document['id']}/sheets")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workPackages"] == []
    assert payload["budget"]["items"] == []
    assert payload["budget"]["currency"] == "EUR"
    assert payload["budget"]["totalRequestedGrant"] == 0
    assert payload["risks"] == []
    assert payload["consortium"] == []


def test_put_budget_tab_recomputes_25_percent_overhead(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "sheets_budget.db", monkeypatch)
    document = _start_application(client)

    items = [
        {"category": "Personnel", "description": "Engineers", "personMonths": 24, "directCost": 200000},
        {"category": "Equipment", "description": "Rigs", "directCost": 40000},
    ]
    response = client.put(f"/api/v1/documents/{document['id']}/sheets/budget", json={"items": items})

    assert response.status_code == 200
    budget = response.json()["budget"]
    assert budget["totalDirectCosts"] == 240000.0
    assert budget["totalIndirectCosts"] == 60000.0
    assert budget["totalRequestedGrant"] == 300000.0

    # Persisted: GET returns the same computed values.
    fetched = client.get(f"/api/v1/documents/{document['id']}/sheets").json()
    assert fetched["budget"]["totalRequestedGrant"] == 300000.0


def test_put_rejects_invalid_rows_and_unknown_tab(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "sheets_invalid.db", monkeypatch)
    document = _start_application(client)

    bad_category = client.put(
        f"/api/v1/documents/{document['id']}/sheets/budget",
        json={"items": [{"category": "Yachts", "directCost": 10}]},
    )
    assert bad_category.status_code == 422

    unknown_tab = client.put(
        f"/api/v1/documents/{document['id']}/sheets/holidays",
        json={"items": []},
    )
    assert unknown_tab.status_code == 422


def test_put_work_packages_risks_consortium_roundtrip(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "sheets_tabs.db", monkeypatch)
    document = _start_application(client)

    wp_response = client.put(
        f"/api/v1/documents/{document['id']}/sheets/work_packages",
        json={"items": [{"number": "WP1", "title": "Pilot", "lead": "Northlight", "personMonths": 6, "startMonth": 1, "endMonth": 8, "deliverables": ["D1.1"]}]},
    )
    assert wp_response.status_code == 200
    assert wp_response.json()["workPackages"][0]["number"] == "WP1"

    risk_response = client.put(
        f"/api/v1/documents/{document['id']}/sheets/risks",
        json={"items": [{"id": "R1", "description": "Delay", "workPackage": "WP1", "likelihood": "low", "severity": "low", "mitigation": "Buffer"}]},
    )
    assert risk_response.status_code == 200

    consortium_response = client.put(
        f"/api/v1/documents/{document['id']}/sheets/consortium",
        json={"items": [{"name": "Partner B", "country": "Spain", "type": "SME", "keyTasks": "Dissemination", "allocatedBudget": 90000}]},
    )
    assert consortium_response.status_code == 200

    sheets = client.get(f"/api/v1/documents/{document['id']}/sheets").json()
    assert len(sheets["workPackages"]) == 1
    assert len(sheets["risks"]) == 1
    assert len(sheets["consortium"]) == 1
    # Budget tab untouched by the other tabs' edits.
    assert sheets["budget"]["items"] == []


def test_generate_sheets_populates_all_four_tabs(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    captured_prompt: dict = {}

    def fake_generate(prompt: str) -> str:
        captured_prompt["value"] = prompt
        return GENERATED_SHEETS_JSON

    monkeypatch.setattr("backend.services.document_service.generate_sheets_via_bedrock", fake_generate)

    client = _build_client(tmp_path / "sheets_generate.db", monkeypatch)
    document = _start_application(client)

    response = client.post(
        f"/api/v1/documents/{document['id']}/sheets/generate",
        json={"grantLimit": 500000},
    )

    assert response.status_code == 200
    sheets = response.json()
    assert [wp["number"] for wp in sheets["workPackages"]] == ["WP1", "WP2"]
    assert sheets["budget"]["totalDirectCosts"] == 280000.0
    assert sheets["budget"]["totalIndirectCosts"] == 70000.0
    assert sheets["budget"]["totalRequestedGrant"] == 350000.0
    assert sheets["risks"][0]["id"] == "R1"
    assert len(sheets["consortium"]) == 2
    assert "Robotics Quality Inspection" in captured_prompt["value"]
    assert "500,000" in captured_prompt["value"]

    persisted = client.get(f"/api/v1/documents/{document['id']}/sheets").json()
    assert persisted["budget"]["totalRequestedGrant"] == 350000.0


def test_generate_sheets_survives_one_bad_tab(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    broken = GENERATED_SHEETS_JSON.replace('"personMonths": 12', '"personMonths": "twelve"')
    monkeypatch.setattr("backend.services.document_service.generate_sheets_via_bedrock", lambda prompt: broken)

    client = _build_client(tmp_path / "sheets_degraded.db", monkeypatch)
    document = _start_application(client)

    response = client.post(f"/api/v1/documents/{document['id']}/sheets/generate", json={})

    assert response.status_code == 200
    sheets = response.json()
    assert sheets["workPackages"] == []
    assert sheets["budget"]["totalRequestedGrant"] > 0


def test_generate_and_get_sheets_require_existing_application(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "sheets_missing.db", monkeypatch)

    assert client.get("/api/v1/documents/missing-doc/sheets").status_code == 404
    assert client.post("/api/v1/documents/missing-doc/sheets/generate", json={}).status_code == 404
