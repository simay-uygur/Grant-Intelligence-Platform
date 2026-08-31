from pathlib import Path

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from backend.api.routes import documents as document_routes
from backend.api.routes import grants as grant_routes
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
    service.agent_service.start_application = lambda grant, profile, custom_instructions=None, template_type=None, attachments="": {
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
    service.agent_service.generate_outline = lambda grant, profile, template_type=None, custom_instructions=None, attachments="": [
        {
            "id": "excellence",
            "title": "1. Excellence",
            "description": "Scientific excellence notes.",
            "targetWords": 180,
        },
        {
            "id": "impact",
            "title": "2. Impact",
            "description": "Societal impact pathways.",
            "targetWords": 180,
        },
    ]
    service.agent_service.rewrite_section = lambda section_title, current_content, profile, grant=None, instruction=None: f"AI rewrite for {profile['organisationName']}."
    service.agent_service.document_qa = lambda question, document, grant=None, profile=None, section_id=None, attachments="": {
        "answer": f"Evaluator advice for '{question}'.",
        "section_id": section_id,
        "suggestions": ["Stronger methodology details", "Include cross-border pilot metrics"],
    }
    monkeypatch.setattr(document_routes, "document_service", service)
    monkeypatch.setattr(grant_routes, "document_service", service)
    return TestClient(create_app())


def _start_application(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/grants/HORIZON-APP-001/start-application",
        json={"grant": GRANT, "profile": PROFILE},
    )
    assert response.status_code == 200
    return response.json()


def test_sections_default_to_revision_one(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "application_revisions.db", monkeypatch)

    document = _start_application(client)

    assert document["sections"][0]["revision"] == 1


def test_section_save_increments_matching_revision(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "section_save_revision.db", monkeypatch)
    document = _start_application(client)

    response = client.put(
        f"/api/v1/applications/{document['id']}/sections/executive-summary",
        json={"content": "Manual edit.", "baseRevision": 1},
    )

    assert response.status_code == 200
    section = response.json()["sections"][0]
    assert section["content"] == "Manual edit."
    assert section["revision"] == 2


def test_section_save_rejects_stale_revision(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "section_save_conflict.db", monkeypatch)
    document = _start_application(client)
    client.put(
        f"/api/v1/applications/{document['id']}/sections/executive-summary",
        json={"content": "First edit.", "baseRevision": 1},
    )

    response = client.put(
        f"/api/v1/applications/{document['id']}/sections/executive-summary",
        json={"content": "Stale edit.", "baseRevision": 1},
    )

    assert response.status_code == 409
    assert "changed since this edit started" in response.json()["detail"]


def test_review_rewrite_does_not_persist_until_apply(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "review_rewrite.db", monkeypatch)
    document = _start_application(client)

    response = client.patch(
        f"/api/v1/documents/{document['id']}/sections/executive-summary",
        json={
            "sectionTitle": "Executive Summary",
            "currentContent": "Draft for Northlight Robotics.",
            "profile": PROFILE,
            "grant": GRANT,
            "baseRevision": 1,
            "persist": False,
        },
    )

    assert response.status_code == 200
    assert response.json()["content"].startswith("AI rewrite")
    stored = client.get(f"/api/v1/applications/{document['id']}").json()
    assert stored["sections"][0]["content"] == "Draft for Northlight Robotics."
    assert stored["sections"][0]["revision"] == 1


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

    grant_application_response = client.get("/api/v1/grants/HORIZON-APP-001/applications/latest")
    assert grant_application_response.status_code == 200
    assert grant_application_response.json()["id"] == document["id"]
    assert grant_application_response.json()["grantId"] == GRANT["id"]

    monkeypatch.setattr(
        document_routes,
        "document_service",
        DocumentService(database_path=str(database_path)),
    )
    reloaded_response = TestClient(create_app()).get(f"/api/v1/applications/{document['id']}")
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
    assert client.get("/api/v1/grants/missing/applications/latest").status_code == 404
    assert (
        client.patch(
            "/api/v1/applications/missing",
            json={"status": "submitted"},
        ).status_code
        == 404
    )

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
    assert client.get("/api/v1/grants/HORIZON-APP-001/applications/latest").status_code == 404


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


def test_document_qa_with_stored_application(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    database_path = tmp_path / "applications.db"
    client = _build_client(database_path, monkeypatch)
    document = _start_application(client)

    response = client.post(
        f"/api/v1/documents/{document['id']}/qa",
        json={"question": "Does this meet excellence criteria?", "sectionId": "executive-summary"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"] == "Evaluator advice for 'Does this meet excellence criteria?'."
    assert payload["sectionId"] == "executive-summary"
    assert payload["suggestions"] == ["Stronger methodology details", "Include cross-border pilot metrics"]


def test_document_qa_with_payload_context(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    database_path = tmp_path / "applications.db"
    client = _build_client(database_path, monkeypatch)

    response = client.post(
        "/api/v1/documents/active-document/qa",
        json={
            "question": "Check compliance",
            "document": {
                "id": "temp-doc-001",
                "grantId": "HORIZON-001",
                "grantTitle": "Robotics Call",
                "sections": [{"id": "sec-1", "title": "Overview", "content": "Test text"}],
                "updatedAt": "2026-08-01T00:00:00Z",
            },
            "grant": GRANT,
            "profile": PROFILE,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"] == "Evaluator advice for 'Check compliance'."
    assert len(payload["suggestions"]) == 2


def test_document_qa_not_found(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    database_path = tmp_path / "applications.db"
    client = _build_client(database_path, monkeypatch)

    response = client.post(
        "/api/v1/documents/non-existent-doc/qa",
        json={"question": "Check compliance"},
    )
    assert response.status_code == 404


def test_conversation_uploads_are_injected_into_drafting(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    captured: dict = {}

    def fake_start(grant, profile, custom_instructions=None, template_type=None, attachments=""):
        captured["attachments"] = attachments
        return {
            "id": "doc-upload-draft-001",
            "grantId": grant["id"],
            "grantTitle": grant["title"],
            "sections": [{"id": "project-summary", "title": "Project Summary", "content": "Draft."}],
            "updatedAt": "2026-08-25T11:00:00Z",
        }

    database_path = tmp_path / "upload_draft.db"
    service = DocumentService(database_path=str(database_path))
    service.agent_service.start_application = fake_start
    monkeypatch.setattr(document_routes, "document_service", service)
    client = TestClient(create_app())

    upload = client.post(
        "/api/v1/documents/upload",
        files={"file": ("track-record.txt", b"We delivered 40 drone inspection pilots across EU ports in 2024.", "text/plain")},
        data={"conversation_id": "conv-123"},
    )
    assert upload.status_code == 200
    assert upload.json()["conversationId"] == "conv-123"

    response = client.post(
        "/api/v1/grants/HORIZON-APP-001/start-application",
        json={"grant": GRANT, "profile": PROFILE, "conversationId": "conv-123"},
    )
    assert response.status_code == 200
    assert "40 drone inspection pilots" in captured["attachments"]

    # A draft without conversation id gets no attachment context.
    client.post("/api/v1/grants/HORIZON-APP-001/start-application", json={"grant": GRANT, "profile": PROFILE})
    assert captured["attachments"] == ""


def test_application_uploads_are_injected_into_side_chat_qa(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    captured: dict = {}

    database_path = tmp_path / "upload_qa.db"
    service = DocumentService(database_path=str(database_path))
    service.agent_service.start_application = lambda grant, profile, custom_instructions=None, template_type=None, attachments="": {
        "id": "doc-upload-qa-001",
        "grantId": grant["id"],
        "grantTitle": grant["title"],
        "sections": [{"id": "project-summary", "title": "Project Summary", "content": "Draft."}],
        "updatedAt": "2026-08-25T11:30:00Z",
    }

    def fake_qa(question, document, grant=None, profile=None, section_id=None, attachments=""):
        captured["attachments"] = attachments
        return {"answer": f"Advice for '{question}'.", "section_id": section_id, "suggestions": []}

    service.agent_service.document_qa = fake_qa
    monkeypatch.setattr(document_routes, "document_service", service)
    client = TestClient(create_app())

    started = client.post("/api/v1/grants/HORIZON-APP-001/start-application", json={"grant": GRANT, "profile": PROFILE})
    document_id = started.json()["id"]

    linked_upload = client.post(
        "/api/v1/documents/upload",
        files={"file": ("annual-report.txt", b"Our 2025 annual report shows EUR 2.1M revenue and 25 staff.", "text/plain")},
        data={"application_id": document_id},
    )
    assert linked_upload.status_code == 200

    qa_response = client.post(
        f"/api/v1/documents/{document_id}/qa",
        json={"question": "Is our budget credible?"},
    )
    assert qa_response.status_code == 200
    assert "EUR 2.1M revenue" in captured["attachments"]


def test_custom_instructions_and_template_are_persisted(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    captured: dict = {}

    def fake_start(grant, profile, custom_instructions=None, template_type=None, attachments=""):
        captured["custom_instructions"] = custom_instructions
        captured["template_type"] = template_type
        return {
            "id": "doc-custom-001",
            "grantId": grant["id"],
            "grantTitle": grant["title"],
            "sections": [{"id": "project-summary", "title": "Project Summary", "content": f"Draft ({template_type})."}],
            "updatedAt": "2026-08-25T09:00:00Z",
        }

    database_path = tmp_path / "customization.db"
    service = DocumentService(database_path=str(database_path))
    service.agent_service.start_application = fake_start
    monkeypatch.setattr(document_routes, "document_service", service)
    client = TestClient(create_app())

    response = client.post(
        "/api/v1/grants/HORIZON-APP-001/start-application",
        json={
            "grant": GRANT,
            "profile": PROFILE,
            "customInstructions": "Emphasise our 15 years of port logistics experience and avoid buzzwords.",
            "templateType": "HORIZON_STANDARD",
        },
    )

    assert response.status_code == 200
    assert captured["custom_instructions"].startswith("Emphasise our 15 years")
    assert captured["template_type"] == "HORIZON_STANDARD"

    stored = client.get("/api/v1/applications/doc-custom-001").json()
    assert stored["customInstructions"].startswith("Emphasise our 15 years")
    assert stored["templateType"] == "HORIZON_STANDARD"


def test_invalid_template_type_is_rejected(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "bad_template.db", monkeypatch)

    response = client.post(
        "/api/v1/grants/HORIZON-APP-001/start-application",
        json={"grant": GRANT, "profile": PROFILE, "templateType": "NOT_A_TEMPLATE"},
    )
    assert response.status_code == 422


def _export_client(database_path: Path, monkeypatch: MonkeyPatch) -> TestClient:

    service = DocumentService(database_path=str(database_path))
    service.agent_service.start_application = lambda grant, profile, custom_instructions=None, template_type=None, attachments="": {
        "id": "doc-export-001",
        "grantId": GRANT["id"],
        "grantTitle": GRANT["title"],
        "sections": [
            {"id": "project-summary", "title": "Project Summary", "content": "AI-powered inspection."},
            {"id": "objectives", "title": "Objectives", "content": "Cut defect rates by 40%.\n\nSecond paragraph."},
        ],
        "updatedAt": "2026-08-25T10:00:00Z",
    }
    monkeypatch.setattr(document_routes, "document_service", service)
    return TestClient(create_app())


def _seed_sheets(client: TestClient) -> None:
    response = client.put(
        "/api/v1/documents/doc-export-001/sheets/budget",
        json={"items": [{"category": "Personnel", "description": "Engineers", "personMonths": 12, "directCost": 100000}]},
    )
    assert response.status_code == 200


def test_export_markdown_includes_sections_and_budget(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _export_client(tmp_path / "export_md.db", monkeypatch)
    started = client.post("/api/v1/grants/HORIZON-APP-001/start-application", json={"grant": GRANT, "profile": PROFILE})
    assert started.status_code == 200
    _seed_sheets(client)

    response = client.get("/api/v1/documents/doc-export-001/export?format=markdown")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    body = response.text
    assert "# Robotics Quality Inspection" in body
    assert "## Project Summary" in body
    assert "Cut defect rates by 40%." in body
    assert "Total requested grant:** EUR 125,000.00" in body


def test_export_html_is_continuous_styled_paper(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _export_client(tmp_path / "export_html.db", monkeypatch)
    client.post("/api/v1/grants/HORIZON-APP-001/start-application", json={"grant": GRANT, "profile": PROFILE})
    _seed_sheets(client)

    response = client.get("/api/v1/documents/doc-export-001/export?format=html")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    body = response.text
    assert body.startswith("<!DOCTYPE html>")
    assert "<h1>Robotics Quality Inspection</h1>" in body
    assert "<h2>Project Summary</h2>" in body
    assert "<table>" in body


def test_export_text_and_missing_document(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _export_client(tmp_path / "export_txt.db", monkeypatch)
    client.post("/api/v1/grants/HORIZON-APP-001/start-application", json={"grant": GRANT, "profile": PROFILE})

    text_response = client.get("/api/v1/documents/doc-export-001/export?format=text")
    assert text_response.status_code == 200
    assert "PROJECT SUMMARY" in text_response.text

    invalid_format = client.get("/api/v1/documents/doc-export-001/export?format=pdf")
    assert invalid_format.status_code == 422

    missing = client.get("/api/v1/documents/missing-doc/export?format=markdown")
    assert missing.status_code == 404


def test_generate_outline_endpoint(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "outline.db", monkeypatch)
    response = client.post(
        "/api/v1/grants/HORIZON-APP-001/outline",
        json={"grant": GRANT, "profile": PROFILE},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["grantId"] == "HORIZON-APP-001"
    assert data["grantTitle"] == "Robotics Quality Inspection"
    assert len(data["sections"]) == 2
    assert data["sections"][0]["id"] == "excellence"
    assert data["sections"][0]["title"] == "1. Excellence"


def test_start_application_with_custom_sections(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    client = _build_client(tmp_path / "custom_sections.db", monkeypatch)
    custom_sections = [
        {"id": "excellence", "title": "1. Excellence"},
        {"id": "impact", "title": "2. Impact"},
    ]
    response = client.post(
        "/api/v1/grants/HORIZON-APP-001/start-application",
        json={"grant": GRANT, "profile": PROFILE, "sections": custom_sections},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "doc-application-001"
