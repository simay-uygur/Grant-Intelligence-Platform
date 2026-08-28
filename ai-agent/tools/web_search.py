# tools/web_search.py
# Real web search using DuckDuckGo (free, no API key, works on Bedrock).
# Used as a fallback when EU Horizon has no strong grant match.

import time


def web_search(query: str, max_results: int = 5):
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
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })
            if results:
                return results
            # empty — wait and retry (likely a transient rate-limit)
            time.sleep(2)
        except Exception as e:
            time.sleep(2)
            if attempt == 2:
                return [{"error": f"web search failed after retries: {e}"}]
    return [{"error": "web search returned no results (possibly rate-limited)"}]