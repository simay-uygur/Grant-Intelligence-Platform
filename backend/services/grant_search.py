from collections.abc import Iterator
from typing import Any

from backend.schemas.grants import GrantResult, GrantSearchRequest, GrantSearchResponse
from backend.services.agent_service import AgentService
from backend.services.application_store import ApplicationStore


class GrantSearchService:
    def __init__(self, application_store: ApplicationStore | None = None) -> None:
        self.agent_service = AgentService()
        self.application_store = application_store or ApplicationStore()

    def _resolve_excluded_ids(self, payload: GrantSearchRequest, user_id: str | None = None) -> list[str]:
        excluded = list(payload.excluded_grant_ids)
        if payload.conversation_id:
            db_offered = self.application_store.get_offered_grant_ids_for_conversation(payload.conversation_id, user_id=user_id)
            for eid in db_offered:
                if eid not in excluded:
                    excluded.append(eid)
        return excluded

    def search(self, payload: GrantSearchRequest, user_id: str | None = None) -> GrantSearchResponse:
        effective_excluded = self._resolve_excluded_ids(payload, user_id=user_id)
        grants = self.agent_service.search_grants(
            payload.to_agent_profile(),
            max_grants=payload.limit,
            excluded_grant_ids=effective_excluded,
        )
        source_summary = "Results discovered through parallel multi-source search across the live EU Funding & Tenders Portal and web grant discovery, ranked against your profile by the AI agent."

        batch_id = None
        batch_index = None
        if payload.conversation_id or user_id:
            batch = self.application_store.record_search_batch(
                grants=grants,
                profile=payload.to_agent_profile(),
                conversation_id=payload.conversation_id,
                user_id=user_id,
                query=payload.query,
                source_summary=source_summary,
            )
            batch_id = batch["id"]
            batch_index = batch["batchIndex"]

        return GrantSearchResponse(
            grants=[GrantResult.model_validate(grant) for grant in grants],
            source_summary=source_summary,
            normalized_filters_applied=payload.to_agent_profile() | {"limit": payload.limit},
            batch_id=batch_id,
            batch_index=batch_index,
        )

    def search_stream(self, payload: GrantSearchRequest, user_id: str | None = None) -> Iterator[dict[str, Any]]:
        effective_excluded = self._resolve_excluded_ids(payload, user_id=user_id)
        source_summary = "Results discovered through parallel multi-source search across the live EU Funding & Tenders Portal and web grant discovery, ranked against your profile by the AI agent."

        for event in self.agent_service.search_grants_stream(
            payload.to_agent_profile(),
            max_grants=payload.limit,
            excluded_grant_ids=effective_excluded,
        ):
            if event.get("event") == "result" and "grants" in event.get("data", {}):
                grants_data = event["data"]["grants"]
                all_candidates_data = event["data"].get("all_candidates")
                batch_id = None
                batch_index = None
                if payload.conversation_id or user_id:
                    batch = self.application_store.record_search_batch(
                        grants=grants_data,
                        profile=payload.to_agent_profile(),
                        conversation_id=payload.conversation_id,
                        user_id=user_id,
                        query=payload.query,
                        source_summary=source_summary,
                    )
                    batch_id = batch["id"]
                    batch_index = batch["batchIndex"]

                response = GrantSearchResponse(
                    grants=[GrantResult.model_validate(grant) for grant in grants_data],
                    all_candidates=[GrantResult.model_validate(c) for c in all_candidates_data] if all_candidates_data else None,
                    source_summary=source_summary,
                    normalized_filters_applied=payload.to_agent_profile() | {"limit": payload.limit},
                    batch_id=batch_id,
                    batch_index=batch_index,
                    eu_count=event["data"].get("eu_count"),
                    web_count=event["data"].get("web_count"),
                )
                event = {
                    **event,
                    "data": response.model_dump(exclude_none=True),
                }
            yield event
