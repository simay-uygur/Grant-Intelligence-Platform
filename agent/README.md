# Grant agent adapter

The backend imports the three functions below from `agent.service`:

- `search_grants(profile, max_grants=3)`
- `start_application(grant, profile)`
- `rewrite_section(section_title, current_content, profile, grant=None, instruction=None)`

Those functions delegate to the Bedrock-backed implementation in `tools/`.
