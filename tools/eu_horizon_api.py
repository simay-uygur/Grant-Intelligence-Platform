"""Client for the public EU Funding & Tenders Portal search API."""

from __future__ import annotations

import json
from typing import Any

import requests

SEARCH_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"


def eu_horizon_api(keyword: str, page_size: int = 3) -> list[dict[str, Any]]:
    """Return open EU grant calls matching a keyword."""
    params = {
        "apiKey": "SEDIA",
        "text": keyword,
        "pageSize": page_size,
        "pageNumber": 1,
    }
    files = {
        "sort": ("blob", json.dumps({"order": "DESC", "field": "startDate"}), "application/json"),
        "query": (
            "blob",
            json.dumps(
                {
                    "bool": {
                        "must": [
                            {"terms": {"type": ["1", "2", "8"]}},
                            {"terms": {"status": ["31094501", "31094502", "31094503"]}},
                            {"terms": {"DATASOURCE": ["SEDIA"]}},
                            {"term": {"programmePeriod": "2021 - 2027"}},
                            {"terms": {"language": ["en"]}},
                        ]
                    }
                }
            ),
            "application/json",
        ),
        "languages": ("blob", json.dumps(["en"]), "application/json"),
        "displayFields": (
            "blob",
            json.dumps(
                [
                    "type",
                    "identifier",
                    "reference",
                    "title",
                    "status",
                    "startDate",
                    "deadlineDate",
                    "frameworkProgramme",
                    "typesOfAction",
                ]
            ),
            "application/json",
        ),
    }

    response = requests.post(SEARCH_URL, params=params, files=files, timeout=30)
    response.raise_for_status()
    data = response.json()

    grants: list[dict[str, Any]] = []
    for item in data.get("results", []):
        metadata = item.get("metadata", {})
        identifier = _first(metadata.get("identifier"))
        grants.append(
            {
                "title": _first(metadata.get("title")) or item.get("title"),
                "identifier": identifier,
                "deadline": _clean_date(_first(metadata.get("deadlineDate"))),
                "programme": _programme_from_identifier(identifier),
                "url": item.get("url"),
            }
        )
    return grants


def _first(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _clean_date(value: Any) -> str | None:
    if not value:
        return None
    return str(value).split("T", 1)[0]


def _programme_from_identifier(identifier: Any) -> str:
    if not identifier:
        return "Unknown"
    prefix = str(identifier).split("-", 1)[0].upper()
    return {
        "HORIZON": "Horizon Europe",
        "DIGITAL": "Digital Europe",
        "LIFE": "LIFE Programme",
        "ERASMUS": "Erasmus+",
        "CEF": "Connecting Europe Facility",
        "EDF": "European Defence Fund",
    }.get(prefix, prefix)
