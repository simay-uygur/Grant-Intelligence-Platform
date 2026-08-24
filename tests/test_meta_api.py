from fastapi.testclient import TestClient

from backend.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def test_health_endpoint_reports_ready() -> None:
    response = _client().get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_frontend_config_advertises_live_frontend_endpoints() -> None:
    response = _client().get("/api/v1/meta/frontend-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["api_prefix"] == "/api/v1"
    endpoints = {(endpoint["name"], endpoint["method"], endpoint["path"]) for endpoint in payload["endpoints"]}
    assert ("health", "GET", "/api/v1/health") in endpoints
    assert (
        "chat_create_conversation",
        "POST",
        "/api/v1/chat/conversations",
    ) in endpoints
    assert ("chat_message", "POST", "/api/v1/chat/message") in endpoints
    assert ("grant_search", "POST", "/api/v1/grants/search") in endpoints
    assert (
        "start_application",
        "POST",
        "/api/v1/grants/{grant_id}/start-application",
    ) in endpoints
    assert (
        "latest_grant_application",
        "GET",
        "/api/v1/grants/{grant_id}/applications/latest",
    ) in endpoints
    assert ("list_applications", "GET", "/api/v1/applications") in endpoints
    assert (
        "get_application",
        "GET",
        "/api/v1/applications/{application_id}",
    ) in endpoints
    assert (
        "update_application_status",
        "PATCH",
        "/api/v1/applications/{application_id}",
    ) in endpoints
    assert (
        "save_application_section",
        "PUT",
        "/api/v1/applications/{application_id}/sections/{section_id}",
    ) in endpoints
    assert (
        "rewrite_section",
        "PATCH",
        "/api/v1/documents/{document_id}/sections/{section_id}",
    ) in endpoints


def test_tools_list_distinguishes_live_and_planned_tools() -> None:
    response = _client().get("/api/v1/meta/tools-list")

    assert response.status_code == 200
    tools = {tool["name"]: tool for tool in response.json()["tools"]}
    assert tools["searchGrants"]["status"] == "live"
    assert tools["searchGrants"]["handler"] == "agent.service.search_grants"
    assert tools["startApplication"]["status"] == "live"
    assert tools["rewriteSection"]["status"] == "live"
    assert tools["searchInternet"]["status"] == "planned"
    assert tools["getGrantDetails"]["status"] == "planned"


def test_chat_loop_preview_describes_backend_orchestration() -> None:
    response = _client().get("/api/v1/chat/loop-preview")

    assert response.status_code == 200
    payload = response.json()
    assert payload["entrypoint"] == "/api/v1/chat/message"
    assert payload["orchestration_owner"] == "backend"
    assert len(payload["loop_steps"]) >= 5
    assert {tool["name"] for tool in payload["sample_tools"]} >= {
        "searchGrants",
        "getGrantDetails",
    }
