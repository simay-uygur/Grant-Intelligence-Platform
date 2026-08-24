# tools/eu_horizon_api.py
# Fetches real EU grant calls from the EU Funding & Tenders Portal (SEDIA search API).
# Public API — no login, no cost. Request format copied from the portal's own frontend call.

import json
import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)

SEARCH_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"


def eu_horizon_api(keyword: str, page_size: int = 3) -> list[dict[str, Any]]:
    """
    Search open EU grant calls by keyword.
    Returns a list of simplified grant dicts: title, identifier, deadline, programme, url.
    """
    # URL query params (same as the portal uses).
    params = {
        "apiKey": "SEDIA",
        "text": keyword,
        "pageSize": page_size,
        "pageNumber": 1,
    }

    # The three JSON parts the API expects, copied from the real portal request.
    # sort: newest first.
    sort = {"order": "DESC", "field": "startDate"}

    # query: this is the exact filter the portal uses — grants (type 1,2,8),
    # open statuses, SEDIA datasource, current programme period, English.
    query = {
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

    # Which fields we want back for each grant.
    display_fields = [
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

    # Each part is sent as a "file" blob in a multipart form (that's how the portal does it).
    files = {
        "sort": ("blob", json.dumps(sort), "application/json"),
        "query": ("blob", json.dumps(query), "application/json"),
        "languages": ("blob", json.dumps(["en"]), "application/json"),
        "displayFields": ("blob", json.dumps(display_fields), "application/json"),
    }

    response = requests.post(SEARCH_URL, params=params, files=files)
    logger.debug("EU Portal search '%s' -> HTTP %s", keyword, response.status_code)

    data = response.json()

    # The results live under "results". Simplify each into a clean dict.
    grants = []
    for item in data.get("results", []):
        meta = item.get("metadata", {})
        identifier = _first(meta.get("identifier"))
        raw_url = item.get("url")
        url = _build_portal_url(identifier, raw_url)
        grants.append(
            {
                "title": _first(meta.get("title")) or item.get("title"),
                "identifier": identifier,
                "deadline": _clean_date(_first(meta.get("deadlineDate"))),
                "programme": _programme_from_identifier(identifier),
                "url": url,
            }
        )
    return grants


def _build_portal_url(identifier: str | None, raw_url: str | None) -> str:
    """Build a working canonical URL to the EU Funding & Tenders Portal for a given topic ID."""
    if identifier:
        clean_id = identifier.strip().lower()
        return f"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/{clean_id}"
    if raw_url and "ec.europa.eu" in raw_url:
        return raw_url
    return "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search"


def _first(value):
    """Portal fields often come back as lists; grab the first item if so."""
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _clean_date(value):
    """Turn '2027-12-01T00:00:00.000+0000' into '2027-12-01'."""
    if not value:
        return None
    return value.split("T")[0]  # keep only the part before the 'T'


def _programme_from_identifier(identifier):
    """
    Read the programme from the grant identifier prefix.
    e.g. 'HORIZON-HLTH-2027-03-TOOL-02' -> 'Horizon Europe'.
    """
    if not identifier:
        return "Unknown"
    prefix = identifier.split("-")[0].upper()  # first chunk before the dash
    mapping = {
        "HORIZON": "Horizon Europe",
        "DIGITAL": "Digital Europe",
        "LIFE": "LIFE Programme",
        "ERASMUS": "Erasmus+",
        "CEF": "Connecting Europe Facility",
        "EDF": "European Defence Fund",
    }
    return mapping.get(prefix, prefix)  # fall back to the raw prefix if unknown


if __name__ == "__main__":
    results = eu_horizon_api("health")
    print(f"\nFound {len(results)} grants:\n")
    for g in results:
        print("-", g["title"])
        print("  Deadline:", g["deadline"], "| Programme:", g["programme"])
        print("  URL:", g["url"])
        print()
