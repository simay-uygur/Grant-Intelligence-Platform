from typing import Any

from pytest import MonkeyPatch

from agent import service


class _PublishedAgentStub:
    def __init__(self) -> None:
        self.calls: dict[str, dict[str, Any]] = {}

    def search_grants(
        self,
        profile: dict[str, Any],
        *,
        user_request: str | None,
        conversation_history: list[dict[str, Any]] | None,
        max_grants: int,
        excluded_grant_ids: list[str] | None,
    ) -> list[dict[str, Any]]:
        self.calls["search_grants"] = {
            "profile": profile,
            "user_request": user_request,
            "conversation_history": conversation_history,
            "max_grants": max_grants,
            "excluded_grant_ids": excluded_grant_ids,
        }
        return []

    def search_grants_stream(
        self,
        profile: dict[str, Any],
        *,
        max_grants: int,
        excluded_grant_ids: list[str] | None,
    ):
        self.calls["search_grants_stream"] = {
            "profile": profile,
            "max_grants": max_grants,
            "excluded_grant_ids": excluded_grant_ids,
        }
        yield {"event": "result", "data": {"grants": []}}


def test_facade_forwards_new_grant_search_arguments(monkeypatch: MonkeyPatch) -> None:
    published = _PublishedAgentStub()
    monkeypatch.setattr(service, "_published_service", lambda: published)
    profile = {"sector": "robotics"}
    history = [{"role": "user", "content": "Find later deadlines"}]

    assert (
        service.search_grants(
            profile,
            user_request="Find alternatives",
            conversation_history=history,
            max_grants=5,
            excluded_grant_ids=["HORIZON-OLD-001"],
        )
        == []
    )
    assert list(
        service.search_grants_stream(
            profile,
            max_grants=4,
            excluded_grant_ids=["HORIZON-OLD-001"],
        )
    ) == [{"event": "result", "data": {"grants": []}}]

    assert published.calls["search_grants"] == {
        "profile": profile,
        "user_request": "Find alternatives",
        "conversation_history": history,
        "max_grants": 5,
        "excluded_grant_ids": ["HORIZON-OLD-001"],
    }
    assert published.calls["search_grants_stream"] == {
        "profile": profile,
        "max_grants": 4,
        "excluded_grant_ids": ["HORIZON-OLD-001"],
    }
