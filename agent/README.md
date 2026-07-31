# Grant agent adapter

This is not the LLM implementation itself. It is the small compatibility
adapter that lets FastAPI keep importing `agent.service` while the published
implementation stays in `ai-agent/`.

The backend imports the three functions below from `agent.service`:

- `search_grants(profile, max_grants=3)`
- `start_application(grant, profile)`
- `rewrite_section(section_title, current_content, profile, grant=None, instruction=None)`

This folder is a stable facade for the backend. It loads the published
Bedrock-backed implementation from `ai-agent/agent/service.py`, whose tools
live in `ai-agent/tools/`.

The `ai-agent/` directory is added to `sys.path` only when one of these
functions is called. This keeps backend startup and tests independent from
AWS until an agent endpoint is used.
