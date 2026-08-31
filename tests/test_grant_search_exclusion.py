from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from backend.api.routes import grants as grant_routes
from backend.main import create_app
from backend.schemas.grants import GrantResult, GrantSearchRequest, GrantSearchResponse
from backend.services.grant_search import GrantSearchService


def test_grant_search_request_excluded_ids() -> None:
    req = GrantSearchRequest(
        sector="robotics",
        country="Germany",
        excluded_grant_ids=["HORIZON-EXCLUDE-001", "Robotics Call A"],
    )
    assert req.excluded_grant_ids == ["HORIZON-EXCLUDE-001", "Robotics Call A"]
    profile = req.to_agent_profile()
    assert profile["sector"] == "robotics"
    assert profile["country"] == "Germany"


def test_grant_search_service_forwards_excluded_ids(monkeypatch: MonkeyPatch) -> None:
    service = GrantSearchService()
    mock_search = MagicMock(
        return_value=[
            {
                "id": "HORIZON-NEW-002",
                "title": "New Clean Grant",
                "programme": "Horizon Europe",
            }
        ]
    )
    service.agent_service.search_grants = mock_search

    payload = GrantSearchRequest(
        sector="robotics",
        excluded_grant_ids=["HORIZON-EXCLUDE-001"],
        limit=5,
    )
    response = service.search(payload)

    assert len(response.grants) == 1
    assert response.grants[0].id == "HORIZON-NEW-002"
    mock_search.assert_called_once_with(
        payload.to_agent_profile(),
        excluded_grant_ids=["HORIZON-EXCLUDE-001"],
    )


def test_grant_search_api_endpoint_with_exclusion(monkeypatch: MonkeyPatch) -> None:
    mock_service = GrantSearchService()
    mock_service.search = MagicMock(
        return_value=GrantSearchResponse(
            grants=[
                GrantResult(
                    id="HORIZON-ALT-002",
                    title="Alternative Energy in Robotics",
                    programme="Horizon Europe",
                )
            ],
            source_summary="Mock test",
            normalized_filters_applied={"sector": "robotics", "limit": 3},
        )
    )
    monkeypatch.setattr(grant_routes, "grant_search_service", mock_service)

    client = TestClient(create_app())
    res = client.post(
        "/api/v1/grants/search",
        json={
            "sector": "robotics",
            "excluded_grant_ids": ["HORIZON-OLD-001"],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["grants"]) == 1
    assert data["grants"][0]["id"] == "HORIZON-ALT-002"
    mock_service.search.assert_called_once()
    assert mock_service.search.call_args[0][0].excluded_grant_ids == ["HORIZON-OLD-001"]
