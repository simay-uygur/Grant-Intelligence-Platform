"""Global Pytest configuration and fixtures.

Ensures that running the test suite uses an isolated temporary database
so that test artifacts (such as mock grants) never leak into storage/backend.db.
"""

from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

import pytest

from backend.api.routes import documents, grants
from backend.core.config import settings
from backend.services.application_store import ApplicationStore
from backend.services.document_service import DocumentService
from backend.services.grant_search import GrantSearchService


@pytest.fixture(autouse=True)
def isolate_test_database(tmp_path: Path) -> Generator[None]:
    """Redirects settings.sqlite_db_path and route singletons to a temporary file for every test."""
    original_db_path = settings.sqlite_db_path
    temp_db_path = str(tmp_path / "test_isolated.db")
    settings.sqlite_db_path = temp_db_path

    # Point route singletons to the isolated test database
    isolated_app_store = ApplicationStore(database_path=temp_db_path)
    isolated_doc_service = DocumentService(database_path=temp_db_path)
    isolated_grant_search_service = GrantSearchService(application_store=isolated_app_store)

    old_doc_service = documents.document_service
    old_grants_doc_service = grants.document_service
    old_grants_search_service = grants.grant_search_service

    documents.document_service = isolated_doc_service
    grants.document_service = isolated_doc_service
    grants.grant_search_service = isolated_grant_search_service

    try:
        yield
    finally:
        settings.sqlite_db_path = original_db_path
        documents.document_service = old_doc_service
        grants.document_service = old_grants_doc_service
        grants.grant_search_service = old_grants_search_service
