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
    "id": "HORIZON-APP-001",
    "title": "Robotics Quality Inspection",
    "programme": "Horizon Europe",
    "fundingAmount": "EUR 500 000",
    "deadline": "2026-12-31",
}


def _build_client(database_path: Path, monkeypatch: MonkeyPatch) -> TestClient:
    service = DocumentService(database_path=str(database_path))
    service.agent_service.start_application = lambda grant, profile: {
        "id": "doc-application-001",
        "grantId": grant["id"],
        "grantTitle": grant["title"],
        "sections": [
            {
                "id": "executive-summary",
                "title": "Executive Summary",
                "content": f"Draft for {profile['organisationName']}.",
            }
        ],
        "updatedAt": "2026-08-06T08:00:00Z",
    }
    service.agent_service.rewrite_section = (
        lambda section_title, current_content, profile, grant=None, instruction=None: (
            f"AI rewrite for {profile['organisationName']}."
        )
    )
    monkeypatch.setattr(document_routes, "document_service", service)
    return TestClient(create_app())


def _start_application(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/grants/HORIZON-APP-001/start-application",
        json={"grant": GRANT, "profile": PROFILE},
    )
    assert response.status_code == 200
    return response.json()


def test_started_application_is_persisted_for_dashboard(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    database_path = tmp_path / "applications.db"
    client = _build_client(database_path, monkeypatch)
    document = _start_application(client)

    list_response = client.get("/api/v1/applications")

    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["total"] == 1
    assert payload["limit"] == 50
    assert payload["offset"] == 0
    assert payload["applications"] == [
        {
            "id": document["id"],
            "grantId": GRANT["id"],
            "grantTitle": GRANT["title"],
            "grantOrganisation": "Horizon Europe",
            "applicantOrganisation": "Northlight Robotics",
            "status": "drafting",
            "fundingAmount": "EUR 500 000",
            "deadline": "2026-12-31",
            "sectionCount": 1,
            "createdAt": payload["applications"][0]["createdAt"],
            "updatedAt": "2026-08-06T08:00:00Z",
        }
    ]

    detail_response = client.get(f"/api/v1/applications/{document['id']}")

    assert detail_response.status_code == 200
    stored = detail_response.json()
    assert stored["sections"] == document["sections"]
    assert stored["grant"] == GRANT
    assert stored["profile"] == PROFILE
    assert stored["status"] == "drafting"

    grant_application_response = client.get(
        "/api/v1/grants/HORIZON-APP-001/applications/latest"
    )
    assert grant_application_response.status_code == 200
    assert grant_application_response.json()["id"] == document["id"]
    assert grant_application_response.json()["grantId"] == GRANT["id"]

    monkeypatch.setattr(
        document_routes,
        "document_service",
        DocumentService(database_path=str(database_path)),
    )
    reloaded_response = TestClient(create_app()).get(
        f"/api/v1/applications/{document['id']}"
    )
    assert reloaded_response.status_code == 200
    assert reloaded_response.json()["sections"] == document["sections"]


def test_application_status_and_output_sections_can_be_updated(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    client = _build_client(tmp_path / "application_updates.db", monkeypatch)
    document = _start_application(client)
    application_path = f"/api/v1/applications/{document['id']}"

    status_response = client.patch(application_path, json={"status": "submitted"})
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "submitted"

    section_response = client.put(
        f"{application_path}/sections/executive-summary",
        json={"content": "Manually edited output."},
    )
    assert section_response.status_code == 200
    assert section_response.json()["sections"][0]["content"] == "Manually edited output."

    submitted_response = client.get("/api/v1/applications?status=submitted")
    assert submitted_response.status_code == 200
    assert submitted_response.json()["total"] == 1

    drafting_response = client.get("/api/v1/applications?status=drafting")
    assert drafting_response.status_code == 200
    assert drafting_response.json()["applications"] == []


def test_ai_rewrite_updates_the_stored_application_output(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    client = _build_client(tmp_path / "application_rewrite.db", monkeypatch)
    document = _start_application(client)

    rewrite_response = client.patch(
        f"/api/v1/documents/{document['id']}/sections/executive-summary",
        json={
            "sectionTitle": "Executive Summary",
            "currentContent": "Draft content.",
            "profile": PROFILE,
            "grant": GRANT,
        },
    )

    assert rewrite_response.status_code == 200
    assert rewrite_response.json()["content"] == "AI rewrite for Northlight Robotics."
    stored = client.get(f"/api/v1/applications/{document['id']}").json()
    assert stored["sections"][0]["content"] == "AI rewrite for Northlight Robotics."


def test_missing_application_and_section_return_not_found(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    client = _build_client(tmp_path / "application_missing.db", monkeypatch)

    assert client.get("/api/v1/applications/missing").status_code == 404
    assert client.get(
        "/api/v1/grants/missing/applications/latest"
    ).status_code == 404
    assert client.patch(
        "/api/v1/applications/missing",
        json={"status": "submitted"},
    ).status_code == 404

    document = _start_application(client)
    response = client.put(
        f"/api/v1/applications/{document['id']}/sections/missing",
        json={"content": "No target section."},
    )
    assert response.status_code == 404

    archive_response = client.patch(
        f"/api/v1/applications/{document['id']}",
        json={"status": "archived"},
    )
    assert archive_response.status_code == 200
    assert client.get(
        "/api/v1/grants/HORIZON-APP-001/applications/latest"
    ).status_code == 404


def test_application_list_query_validation(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    client = _build_client(tmp_path / "application_validation.db", monkeypatch)

    assert client.get("/api/v1/applications?status=unknown").status_code == 422
    assert client.get("/api/v1/applications?limit=101").status_code == 422
    assert client.get("/api/v1/applications?offset=-1").status_code == 422


def test_start_application_rejects_a_mismatched_grant_id(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    client = _build_client(tmp_path / "application_grant_mismatch.db", monkeypatch)

    response = client.post(
        "/api/v1/grants/DIFFERENT-GRANT/start-application",
        json={"grant": GRANT, "profile": PROFILE},
    )

    assert response.status_code == 400
    assert client.get("/api/v1/applications").json()["total"] == 0


def test_saved_grants_api_crud_and_validation(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    client = _build_client(tmp_path / "saved_grants_api.db", monkeypatch)

    # 1. Invalid payload missing required fields returns 422 Unprocessable Entity
    invalid_response = client.post("/api/v1/grants/saved", json={"title": "No ID"})
    assert invalid_response.status_code == 422

    # 2. Valid save returns 200 with typed response
    valid_payload = {
        "id": "HORIZON-TEST-001",
        "title": "Digital Green Horizon",
        "programme": "Horizon Europe",
        "fundingAmount": "EUR 1 000 000",
        "deadline": "2026-11-30",
        "matchPercentage": 95,
        "whyItMatches": "High relevance to sustainability targets.",
    }
    save_response = client.post("/api/v1/grants/saved", json=valid_payload)
    assert save_response.status_code == 200
    saved_data = save_response.json()
    assert saved_data["id"] == "HORIZON-TEST-001"
    assert saved_data["matchPercentage"] == 95

    # 3. List returns typed array
    list_response = client.get("/api/v1/grants/saved")
    assert list_response.status_code == 200
    assert len(list_response.json()["savedGrants"]) == 1
    assert list_response.json()["savedGrants"][0]["id"] == "HORIZON-TEST-001"

    # 4. Delete saved grant
    delete_response = client.delete("/api/v1/grants/saved/HORIZON-TEST-001")
    assert delete_response.status_code == 204

    # 5. Verify empty list after delete
    empty_list_response = client.get("/api/v1/grants/saved")
    assert len(empty_list_response.json()["savedGrants"]) == 0
