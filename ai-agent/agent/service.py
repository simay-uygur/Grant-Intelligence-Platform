# agent/service.py
# The service layer the backend calls. Maps directly to the frontend's methods:
#   search_grants(profile)          -> searchGrants
#   start_application(grant,profile)-> startApplication
#   rewrite_section(...)            -> rewriteSection
# These are reliable structured functions — no agent-loop ambiguity.

import os

# Ensure Bedrock auth is set no matter how this is imported.
os.environ["CLAUDE_CODE_USE_BEDROCK"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

from tools.eu_horizon_api import eu_horizon_api
from tools.grant_selector import select_grants
from tools.start_application import start_application as _start_application
from tools.rewrite_section import rewrite_section as _rewrite_section
from tools.keyword_agent import generate_keywords
from tools.grant_searcher import search_all


def search_grants(profile, max_grants=3):
    """
    Frontend: searchGrants(profile) -> Grant[]
    Multi-part pipeline:
      1. keyword_agent  -> generate several smart search keywords
      2. grant_searcher -> search all keywords, pool candidates
      3. structure_grants -> score & select the best matches
    """
    # 1. Generate multiple keywords from the profile.
    keywords = generate_keywords(profile, max_keywords=5)

    # 2. Search all keywords and pool unique candidates.
    candidates = search_all(keywords, page_size=10)

    # Safety: if nothing came back, return empty rather than crash.
    if not candidates:
        return []

    # 3. Score and select the best matches from the full pool.
    grants = select_grants(candidates, profile, max_grants=max_grants)
    return grants


def start_application(grant, profile):
    """
    Frontend: startApplication(grant, profile) -> ApplicationDocument
    """
    return _start_application(grant, profile)


def rewrite_section(section_title, current_content, profile, grant=None, instruction=None):
    """
    Frontend: rewriteSection(sectionTitle, currentContent, profile, grant) -> string
    """
    return _rewrite_section(
        section_title=section_title,
        current_content=current_content,
        profile=profile,
        grant=grant,
        instruction=instruction,
    )