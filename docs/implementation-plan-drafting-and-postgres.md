# Implementation Plan: Grant-Tailored Application Drafting & PostgreSQL Migration

> Revised 2026-08-24. Supersedes earlier draft.
> Key decisions: **SQLAlchemy Core** (not ORM) · **PostgreSQL only** (no MySQL) ·
> **AWS Lightsail Managed DB** (not RDS) · **SQLite stays the local default** ·
> **Component 1 ships before Component 2 starts.**

---

## Component 1: Grant-Tailored Application Drafting Engine

### Problem

The agent drafts applications from a grant payload containing only
`title, identifier, deadline, programme, url`. Claude cannot tailor prose to call
objectives it never sees. A richer extraction (`_build_summary`, using the
`descriptionByte` metadata field) already exists in
`backend/clients/sources/eu_horizon.py` but is not available to the agent.

### Changes

| File | Change |
|---|---|
| `ai-agent/tools/eu_horizon_api.py` | Request `descriptionByte` in `display_fields`; port HTML-stripping summary helper; include `summary` (~1,500 chars) in each result dict |
| `ai-agent/tools/start_application.py` | Prompts explicitly instruct Claude to tie every section to the grant's call objectives/priorities from the new `summary`; reject generic company boilerplate when a summary is present |
| `ai-agent/agent/service.py` | Thinking events mention the grant's programme/call focus during drafting |
| `ai-agent/agent/stream_agent.py` | No change needed — candidates JSON flows into the selection prompt and now carries summaries automatically |

### Verification

```bash
pytest tests -q                                   # repo-root tests (NOT backend/tests)
python3 -c "from tools.eu_horizon_api import eu_horizon_api; \
  r = eu_horizon_api('robotics'); print(r[0].get('summary', 'MISSING')[:200])"
```

Manual: draft an application from a live search and confirm sections reference
call-specific objectives rather than generic company text.

---

## Component 2: PostgreSQL Migration (Lightsail Managed DB)

### Decisions

- **SQLAlchemy Core**, not ORM: stores keep explicit table objects and
  SQL-expression queries — closest to today's raw `sqlite3` code, smallest rewrite.
- **SQLite remains default**: no `DATABASE_URL` set → unchanged local behaviour.
- **PostgreSQL only**: driver is `psycopg[binary]`. No MySQL.
- **Target host**: AWS Lightsail Managed Database (`us-east-1`, same region as containers).

### Changes

| File | Change |
|---|---|
| `backend/core/database.py` *(new)* | Engine/session factory from `settings.database_url`; Core `MetaData` with shared tables |
| `backend/migrations/` + `alembic.ini` *(new)* | Alembic config; initial migration matching current SQLite schema |
| `backend/core/config.py` | Point existing `database_url` at `sqlite:///storage/backend.db` default; document Lightsail URL format |
| `application_store.py`, `conversation_store.py`, `auth_service.py` | Convert raw `sqlite3` calls to Core table expressions against the shared engine |
| `requirements.txt` | Add `sqlalchemy>=2.0`, `alembic>=1.13`, `psycopg[binary]>=3.1` |

### Data migration (decide before deploy)

Alembic migrates schema, not rows. Either accept a fresh database on first
production migration, or run a one-time SQLite→Postgres copy script
(~50 lines, per-table `INSERT`). Existing local dev data does not need migrating.

### Deployment wiring

Add to the `LIGHTSAIL_BACKEND_ENV` GitHub Secret:

```
DATABASE_URL=postgresql://<user>:<password>@<lightsail-db-endpoint>.aws-region.rds.amazonaws.com:5432/grant_db
SESSION_STORAGE_TYPE=hosted
```

Keep DB and container services in the same region; Lightsail managed DBs are
private-network by default — enable public access only if you need to run
migrations from a laptop.

### Verification

```bash
pytest tests -q                # green on SQLite, unchanged
DATABASE_URL=postgresql://... alembic upgrade head   # schema on Postgres
DATABASE_URL=postgresql://... pytest tests -q        # suite against Postgres
```

`ai-agent/tests/test_bedrock.py` and friends stay out of CI (require real AWS credentials).
