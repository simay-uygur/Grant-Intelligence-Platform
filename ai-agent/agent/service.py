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
from tools.structure_grants import structure_grants
from tools.start_application import start_application as _start_application
from tools.rewrite_section import rewrite_section as _rewrite_section


def search_grants(profile, max_grants=3):
    """
    Frontend: searchGrants(profile) -> Grant[]
    Takes the organisation profile, searches real EU grants, returns structured Grant[].
    """
    # Pick search keywords from the profile. Use sector/keywords if present, else a default.
    keyword = (
        profile.get("sector")
        or profile.get("projectTitle")
        or profile.get("organisationType")
        or "innovation"
    )
    # Keep it simple: first meaningful word works best with the EU API.
    keyword = str(keyword).split()[0].lower()

    raw = eu_horizon_api(keyword, page_size=15)
    grants = structure_grants(raw, profile, max_grants=max_grants)
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