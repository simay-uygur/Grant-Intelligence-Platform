# tools/web_search.py
# Real web search using DuckDuckGo (free, no API key, works on Bedrock).
# Powers parallel multi-source grant discovery across national, regional,
# foundational, and international funding programmes alongside EU Portal searches.

import hashlib
import html
import re
import time
from typing import Any


def web_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """
    Search the web for funding opportunities.
    Returns a list of dicts: {title, url, snippet}. Real results with real URLs.
    Retries a couple of times if the free search endpoint rate-limits.
    """
    # Prefer the new package name; fall back to the old one.
    try:
        from ddgs import DDGS
    except ImportError:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return [{"error": "web search library not installed"}]

    for attempt in range(3):
        try:
            results = []
            for r in DDGS().text(query, max_results=max_results):
                results.append(
                    {
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "snippet": r.get("body", ""),
                    }
                )
            if results:
                return results
            # empty — wait and retry (likely a transient rate-limit)
            time.sleep(1)
        except Exception as e:
            time.sleep(1)
            if attempt == 2:
                return [{"error": f"web search failed after retries: {e}"}]
    return [{"error": "web search returned no results (possibly rate-limited)"}]


def _extract_domain(url: str) -> str:
    """Extract human-readable domain or organization name from a URL."""
    try:
        domain = re.sub(r"^https?://(www\.)?", "", url).split("/")[0]
        return domain
    except Exception:
        return "Web Source"


def web_search_funding_opportunities(
    keyword: str,
    country: str | None = None,
    max_results: int = 5,
) -> list[dict[str, Any]]:
    """
    Execute targeted parallel web search for grant opportunities matching keyword & country.
    Returns structured candidate objects ready to be pooled alongside EU Horizon calls.
    """
    country_part = f" {country}" if country and country.lower() not in {"any", "all", "europe", "eu"} else ""
    query = f"{keyword} grant call funding Europe 2025 2026{country_part}"

    raw_results = web_search(query, max_results=max_results)
    candidates: list[dict[str, Any]] = []

    for r in raw_results:
        if "error" in r or not r.get("title") or not r.get("url"):
            continue

        raw_url = str(r["url"]).strip()
        title = html.unescape(str(r["title"])).strip()
        snippet = html.unescape(str(r.get("snippet", ""))).strip()

        # Clean title of common search engine suffixes
        clean_title = re.sub(r"\s*[-|–—]\s*(Home|Official Site|Overview|Welcome|Portal).*$", "", title, flags=re.IGNORECASE).strip() or title

        url_hash = hashlib.sha256(raw_url.encode("utf-8")).hexdigest()[:8]
        candidate_id = f"web-{url_hash}"
        domain = _extract_domain(raw_url)

        # Derive a sensible programme label from domain or title
        programme = "Web Grant Discovery"
        if "eic" in clean_title.lower() or "eic" in domain:
            programme = "EIC Programme"
        elif "eureka" in clean_title.lower() or "eurostars" in clean_title.lower():
            programme = "Eureka / Eurostars"
        elif "innovate" in clean_title.lower() or "innovateuk" in domain:
            programme = "Innovate UK"
        elif "erc" in clean_title.lower():
            programme = "ERC Programme"
        elif domain:
            programme = f"{domain} Grants"

        candidates.append(
            {
                "id": candidate_id,
                "identifier": f"WEB-{url_hash.upper()}",
                "title": clean_title,
                "programme": programme,
                "source": "Web Search",
                "url": raw_url,
                "sourceUrl": raw_url,
                "summary": snippet or clean_title,
                "description": snippet or clean_title,
                "deadline": None,
                "budget": "See call details",
            }
        )

    return candidates
