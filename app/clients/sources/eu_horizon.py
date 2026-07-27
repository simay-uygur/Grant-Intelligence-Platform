from __future__ import annotations

import html
import json
import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.schemas.grants import GrantResult, GrantSearchRequest


class EUHorizonClient:
    SEARCH_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"
    API_KEY = "SEDIA"
    HORIZON_PROGRAMME_CODE = "43108390"
    TOPIC_URL_SEGMENT = "/screen/opportunities/topic-details/"

    def __init__(self, transport: httpx.BaseTransport | None = None) -> None:
        self.transport = transport

    def search(self, payload: GrantSearchRequest) -> list[GrantResult]:
        params = {
            "apiKey": self.API_KEY,
            "text": self._build_search_text(payload),
            "language": "en",
        }

        with httpx.Client(
            timeout=20.0,
            transport=self.transport,
            follow_redirects=True,
        ) as client:
            response = client.post(self.SEARCH_URL, params=params)
            response.raise_for_status()

        results = response.json().get("results", [])
        grants: list[GrantResult] = []
        seen_ids: set[str] = set()

        for raw_result in results:
            grant = self._normalize_result(raw_result)
            if grant is None:
                continue
            if grant.id in seen_ids:
                continue
            if not self._matches_filters(grant, raw_result, payload):
                continue

            seen_ids.add(grant.id)
            grants.append(grant)

            if len(grants) >= payload.limit:
                break

        return grants

    def _build_search_text(self, payload: GrantSearchRequest) -> str:
        if payload.query:
            return payload.query
        if payload.keywords:
            return " ".join(payload.keywords)
        return f"HORIZON-{datetime.now(UTC).year}"

    def _normalize_result(self, raw_result: dict[str, Any]) -> GrantResult | None:
        metadata = raw_result.get("metadata") or {}
        url = raw_result.get("url") or self._first(metadata, "url")
        if not url or self.TOPIC_URL_SEGMENT not in url:
            return None
        if not self._is_horizon_topic(metadata):
            return None

        identifier = self._first(metadata, "identifier") or url.rstrip("/").split("/")[-1]
        title = self._first(metadata, "title") or raw_result.get("summary") or identifier
        summary = self._build_summary(metadata, raw_result)
        deadline = self._extract_deadline(metadata)
        amount = self._extract_budget(metadata)
        action_type = self._extract_action_type(metadata)

        match_parts = [f"Matched Horizon topic {identifier}"]
        if action_type:
            match_parts.append(action_type)
        if deadline:
            match_parts.append(f"deadline {deadline}")

        return GrantResult(
            id=identifier,
            title=title,
            source="eu_horizon",
            summary=summary,
            amount=amount,
            deadline=deadline,
            match_explanation="; ".join(match_parts),
            url=url,
        )

    def _matches_filters(
        self,
        grant: GrantResult,
        raw_result: dict[str, Any],
        payload: GrantSearchRequest,
    ) -> bool:
        metadata = raw_result.get("metadata") or {}

        if payload.programme_period:
            programme_period = self._first(metadata, "programmePeriod")
            if programme_period != payload.programme_period:
                return False

        if payload.action_type:
            action_type = self._extract_action_type(metadata)
            if not action_type or payload.action_type.lower() not in action_type.lower():
                return False

        if payload.only_open:
            if not self._is_open(metadata):
                return False

        budget_value = self._parse_amount(grant.amount)
        if payload.budget_min is not None and (
            budget_value is None or budget_value < payload.budget_min
        ):
            return False
        if payload.budget_max is not None and (
            budget_value is None or budget_value > payload.budget_max
        ):
            return False

        return True

    def _is_horizon_topic(self, metadata: dict[str, Any]) -> bool:
        framework_programme = metadata.get("frameworkProgramme") or []
        programmes = metadata.get("esST_programmes") or []
        return (
            self.HORIZON_PROGRAMME_CODE in framework_programme
            or "Horizon Europe (HORIZON)" in programmes
        )

    def _build_summary(self, metadata: dict[str, Any], raw_result: dict[str, Any]) -> str:
        description = self._first(metadata, "descriptionByte")
        if description:
            cleaned = self._strip_html(description)
            if cleaned:
                return cleaned[:600]

        summary = raw_result.get("summary")
        if summary:
            return html.unescape(summary)

        return "No summary was provided by the Horizon API."

    def _extract_deadline(self, metadata: dict[str, Any]) -> str | None:
        deadline = self._first(metadata, "deadlineDate")
        if deadline:
            return deadline.split("T")[0]

        actions_raw = self._first(metadata, "actions")
        if not actions_raw:
            return None

        try:
            actions = json.loads(actions_raw)
        except json.JSONDecodeError:
            return None

        for action in actions:
            deadline_dates = action.get("deadlineDates") or []
            if deadline_dates:
                return deadline_dates[0]
        return None

    def _extract_budget(self, metadata: dict[str, Any]) -> str | None:
        budget_raw = self._first(metadata, "budgetOverview")
        if not budget_raw:
            return None

        try:
            budget_overview = json.loads(budget_raw)
        except json.JSONDecodeError:
            return None

        budget_map = budget_overview.get("budgetTopicActionMap") or {}
        contributions: list[int] = []

        for actions in budget_map.values():
            for action in actions:
                max_contribution = action.get("maxContribution")
                if isinstance(max_contribution, int | float):
                    contributions.append(int(max_contribution))

        if not contributions:
            return None

        low = min(contributions)
        high = max(contributions)
        if low == high:
            return f"EUR {low:,}".replace(",", " ")
        return f"EUR {low:,} - EUR {high:,}".replace(",", " ")

    def _extract_action_type(self, metadata: dict[str, Any]) -> str | None:
        types = metadata.get("typesOfAction") or metadata.get("esST_typeOfAction") or []
        if not types:
            return None
        return types[0]

    def _is_open(self, metadata: dict[str, Any]) -> bool:
        actions_raw = self._first(metadata, "actions")
        if actions_raw:
            try:
                actions = json.loads(actions_raw)
            except json.JSONDecodeError:
                actions = []
            for action in actions:
                status = ((action.get("status") or {}).get("abbreviation") or "").lower()
                if status == "open":
                    return True

        deadline = self._extract_deadline(metadata)
        if deadline is None:
            return False

        try:
            return datetime.fromisoformat(deadline).date() >= datetime.now(UTC).date()
        except ValueError:
            return False

    def _parse_amount(self, amount: str | None) -> int | None:
        if not amount:
            return None
        numbers = [int(value.replace(" ", "")) for value in re.findall(r"\d[\d ]*", amount)]
        if not numbers:
            return None
        return max(numbers)

    def _first(self, metadata: dict[str, Any], key: str) -> str | None:
        values = metadata.get(key) or []
        if not values:
            return None
        return values[0]

    def _strip_html(self, value: str) -> str:
        cleaned = re.sub(r"<[^>]+>", " ", value)
        cleaned = html.unescape(cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()
