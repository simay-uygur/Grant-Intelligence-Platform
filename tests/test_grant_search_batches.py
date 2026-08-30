from __future__ import annotations

import tempfile
import uuid

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.schemas.grants import GrantSearchRequest
from backend.services.application_store import ApplicationStore
from backend.services.grant_search import GrantSearchService


@pytest.fixture
def temp_store():
    with tempfile.NamedTemporaryFile(suffix=".db") as f:
        store = ApplicationStore(database_path=f.name)
        yield store


def test_record_and_list_search_batches(temp_store: ApplicationStore):
    conv_id = "conv-test-123"
    profile = {"organisationName": "Acme AI", "sector": "robotics"}
    grants_batch_1 = [
        {"id": "GRANT-1", "title": "Robotics AI 1", "matchPercentage": 90},
        {"id": "GRANT-2", "title": "Robotics AI 2", "matchPercentage": 85},
    ]

    batch1 = temp_store.record_search_batch(
        grants=grants_batch_1,
        profile=profile,
        conversation_id=conv_id,
        query="robotics",
        source_summary="EU Horizon",
    )

    assert batch1["id"] is not None
    assert batch1["conversationId"] == conv_id
    assert batch1["batchIndex"] == 1
    assert len(batch1["grants"]) == 2

    # Record second batch for same conversation
    grants_batch_2 = [
        {"id": "GRANT-3", "title": "Robotics AI 3", "matchPercentage": 80},
    ]
    batch2 = temp_store.record_search_batch(
        grants=grants_batch_2,
        profile=profile,
        conversation_id=conv_id,
        query="robotics round 2",
    )

    assert batch2["batchIndex"] == 2

    # List batches
    batches = temp_store.list_search_batches(conversation_id=conv_id)
    assert len(batches) == 2
    assert batches[0]["batchIndex"] == 1
    assert batches[1]["batchIndex"] == 2

    # Get single batch
    fetched = temp_store.get_search_batch(batch1["id"])
    assert fetched is not None
    assert fetched["id"] == batch1["id"]
    assert fetched["grants"][0]["id"] == "GRANT-1"

    # Get offered grant IDs for conversation
    offered_ids = temp_store.get_offered_grant_ids_for_conversation(conv_id)
    assert "GRANT-1" in offered_ids
    assert "GRANT-2" in offered_ids
    assert "GRANT-3" in offered_ids


def test_grant_search_service_auto_exclusion(temp_store: ApplicationStore):
    conv_id = "conv-auto-exclude"
    profile = {"organisationName": "BioMed Lab", "sector": "health"}
    grants_1 = [{"id": "HEALTH-01", "title": "Health grant 1"}]

    temp_store.record_search_batch(
        grants=grants_1,
        profile=profile,
        conversation_id=conv_id,
    )

    search_service = GrantSearchService(application_store=temp_store)

    # Mock agent_service.search_grants to capture passed excluded_grant_ids
    captured_excluded: list[str] = []

    def mock_search_grants(p, max_grants=3, excluded_grant_ids=None):
        nonlocal captured_excluded
        captured_excluded = excluded_grant_ids or []
        return [{"id": "HEALTH-02", "title": "Health grant 2"}]

    search_service.agent_service.search_grants = mock_search_grants

    # Call search with conversation_id
    payload = GrantSearchRequest(
        organisationName="BioMed Lab",
        sector="health",
        conversation_id=conv_id,
        excluded_grant_ids=["MANUAL-EXCLUDE"],
    )

    resp = search_service.search(payload)
    assert resp.batch_index == 2
    assert "HEALTH-01" in captured_excluded
    assert "MANUAL-EXCLUDE" in captured_excluded

    # Verify both batches exist now
    batches = temp_store.list_search_batches(conversation_id=conv_id)
    assert len(batches) == 2


def test_grant_batches_api_endpoints():
    app = create_app()
    client = TestClient(app)

    unique_conv_id = f"conv-api-{uuid.uuid4().hex[:8]}"

    # Search with conversation_id to create a batch
    search_payload = {
        "organisationName": "Vision AI",
        "sector": "computer vision",
        "conversation_id": unique_conv_id,
    }

    # Mock search response on router
    search_resp = client.post("/api/v1/grants/search", json=search_payload)
    assert search_resp.status_code == 200
    data = search_resp.json()
    batch_id = data.get("batch_id")
    assert batch_id is not None
    assert data.get("batch_index") == 1

    # List batches via API
    list_resp = client.get(f"/api/v1/grants/batches?conversation_id={unique_conv_id}")
    assert list_resp.status_code == 200
    batches_data = list_resp.json().get("batches", [])
    assert len(batches_data) == 1
    assert batches_data[0]["conversationId"] == unique_conv_id

    # Get specific batch via API
    get_resp = client.get(f"/api/v1/grants/batches/{batch_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == batch_id
