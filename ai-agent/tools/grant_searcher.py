# tools/grant_searcher.py
# Part 2 of the pipeline.
# Runs the EU API for each keyword and gathers all candidate grants into one
# deduplicated pool. Pure retrieval — no judgment here.

from tools.eu_horizon_api import eu_horizon_api


def search_all(keywords, page_size=10):
    """
    keywords: list of search words
    Returns a deduplicated list of candidate grant dicts.
    """
    pool = {}  # keyed by identifier/title to dedupe

    for kw in keywords:
        try:
            results = eu_horizon_api(kw, page_size=page_size)
        except Exception as e:
            print(f"[grant_searcher] search failed for '{kw}': {e}")
            continue

        for g in results:
            # Use identifier if present, else title, as the dedupe key.
            key = g.get("identifier") or g.get("title")
            if key and key not in pool:
                pool[key] = g

    candidates = list(pool.values())
    print(f"[grant_searcher] Pooled {len(candidates)} unique candidate grants "
          f"from {len(keywords)} keyword(s).")
    return candidates