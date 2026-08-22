"""Direct unit tests for ApplicationStore layer."""

from pathlib import Path
import pytest

from backend.schemas.documents import ApplicationDocument, DocumentSection
from backend.services.application_store import (
    ApplicationStore,
    StoredApplicationSectionNotFoundError,
)


@pytest.fixture
def store(tmp_path: Path) -> ApplicationStore:
    return ApplicationStore(str(tmp_path / "test_app_store.db"))


SAMPLE_DOC = ApplicationDocument(
    id="app-doc-001",
    grantId="GRANT-100",
    grantTitle="AI for Healthcare",
    sections=[
        DocumentSection(id="sec-1", title="Abstract", content="Initial summary content."),
        DocumentSection(id="sec-2", title="Budget", content="EUR 50,000 details."),
    ],
    updatedAt="2026-08-16T12:00:00Z",
)

GRANT_DATA = {"id": "GRANT-100", "title": "AI for Healthcare", "programme": "Horizon Europe"}
PROFILE_DATA = {"organisationName": "HealthTech Ltd", "country": "Germany"}


def test_save_and_retrieve_application(store: ApplicationStore) -> None:
    saved = store.save_application(SAMPLE_DOC, grant=GRANT_DATA, profile=PROFILE_DATA, user_id="user-1")
    assert saved["id"] == "app-doc-001"
    assert saved["grantId"] == "GRANT-100"
    assert saved["status"] == "drafting"
    assert len(saved["sections"]) == 2

    retrieved = store.get_application("app-doc-001", user_id="user-1")
    assert retrieved is not None
    assert retrieved["grantTitle"] == "AI for Healthcare"


def test_list_applications_with_pagination(store: ApplicationStore) -> None:
    for i in range(5):
        doc = ApplicationDocument(
            id=f"app-doc-{i}",
            grantId=f"GRANT-{i}",
            grantTitle=f"Grant {i}",
            sections=[DocumentSection(id="sec-1", title="T", content="C")],
            updatedAt=f"2026-08-16T12:0{i}:00Z",
        )
        store.save_application(doc, grant={"id": f"GRANT-{i}"}, profile={})

    items, total = store.list_applications(limit=2, offset=0)
    assert total == 5
    assert len(items) == 2

    items_page2, total = store.list_applications(limit=2, offset=2)
    assert total == 5
    assert len(items_page2) == 2


def test_list_applications_filters_by_status(store: ApplicationStore) -> None:
    store.save_application(SAMPLE_DOC, grant=GRANT_DATA, profile=PROFILE_DATA)
    store.update_status("app-doc-001", "submitted")

    doc2 = ApplicationDocument(
        id="app-doc-002",
        grantId="GRANT-200",
        grantTitle="Green Energy",
        sections=[],
        updatedAt="2026-08-16T13:00:00Z",
    )
    store.save_application(doc2, grant={"id": "GRANT-200"}, profile={})

    submitted, count = store.list_applications(status="submitted")
    assert count == 1
    assert submitted[0]["id"] == "app-doc-001"

    drafting, count = store.list_applications(status="drafting")
    assert count == 1
    assert drafting[0]["id"] == "app-doc-002"


def test_update_status(store: ApplicationStore) -> None:
    store.save_application(SAMPLE_DOC, grant=GRANT_DATA, profile=PROFILE_DATA)
    updated = store.update_status("app-doc-001", "under_review")
    assert updated is not None
    assert updated["status"] == "under_review"

    # Updating non-existent app returns None
    assert store.update_status("non-existent", "approved") is None


def test_update_section_content(store: ApplicationStore) -> None:
    store.save_application(SAMPLE_DOC, grant=GRANT_DATA, profile=PROFILE_DATA)
    updated = store.update_section("app-doc-001", "sec-1", "Updated summary content.")
    assert updated is not None
    assert updated["sections"][0]["content"] == "Updated summary content."


def test_update_section_raises_for_missing_section(store: ApplicationStore) -> None:
    store.save_application(SAMPLE_DOC, grant=GRANT_DATA, profile=PROFILE_DATA)
    with pytest.raises(StoredApplicationSectionNotFoundError, match="Section 'missing-sec' does not exist"):
        store.update_section("app-doc-001", "missing-sec", "New content")


def test_get_latest_application_for_grant_excludes_archived(store: ApplicationStore) -> None:
    store.save_application(SAMPLE_DOC, grant=GRANT_DATA, profile=PROFILE_DATA)
    store.update_status("app-doc-001", "archived")

    latest = store.get_latest_application_for_grant("GRANT-100")
    assert latest is None


def test_upsert_on_conflict(store: ApplicationStore) -> None:
    store.save_application(SAMPLE_DOC, grant=GRANT_DATA, profile=PROFILE_DATA)

    updated_doc = ApplicationDocument(
        id="app-doc-001",
        grantId="GRANT-100",
        grantTitle="AI for Healthcare (Updated)",
        sections=[DocumentSection(id="sec-1", title="Abstract", content="New Content.")],
        updatedAt="2026-08-16T15:00:00Z",
    )
    store.save_application(updated_doc, grant=GRANT_DATA, profile=PROFILE_DATA)

    retrieved = store.get_application("app-doc-001")
    assert retrieved is not None
    assert retrieved["grantTitle"] == "AI for Healthcare (Updated)"
    assert retrieved["sections"][0]["content"] == "New Content."


def test_saved_grants_persistence(store: ApplicationStore) -> None:
    grant = {
        "id": "grant-99",
        "title": "Clean Tech Accelerator",
        "programme": "Horizon Europe",
        "fundingAmount": "€1,000,000",
        "deadline": "2026-11-30",
        "sourceUrl": "https://example.org/grant-99",
        "matchPercentage": 92,
        "whyItMatches": "High alignment with renewable energy domain.",
    }

    saved = store.save_grant(grant, user_id="user-1")
    assert saved["id"] == "grant-99"
    assert saved["matchPercentage"] == 92
    assert saved["whyItMatches"] == "High alignment with renewable energy domain."

    listed = store.list_saved_grants(user_id="user-1")
    assert len(listed) == 1
    assert listed[0]["title"] == "Clean Tech Accelerator"
    assert listed[0]["matchPercentage"] == 92

    deleted = store.delete_saved_grant("grant-99", user_id="user-1")
    assert deleted is True

    listed_after = store.list_saved_grants(user_id="user-1")
    assert len(listed_after) == 0
