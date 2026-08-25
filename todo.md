# TODO - Grant Intelligence Platform

## Primary Goal

Build a working grant-assistant backend locally first, connect it to the frontend, optimize application document workflows with informative streaming, and prepare for production deployment.

- [x] **Interactive Q&A for Specific Grant-Tailored Application Document (Backend)**:
  - Implement `POST /api/v1/documents/{document_id}/qa` and `/stream` backend endpoints.
  - Enable targeted Q&A in the chat composer specifically for the active grant-tailored application draft.
  - Allow users to ask questions, request section revisions, or query grant compliance directly against the document and grant call context.
- [x] **"Didn't Like the Grants / Search Again" with Exclusion Filter (Full-Stack)**:
  - Add `excluded_grant_ids: list[str]` to `GrantSearchRequest` and backend agent search tools.
  - Filter out previously viewed/rejected grants to return fresh alternative European grant calls.
  - Connected the frontend "Find alternative grants / Search again" action with history-derived grant exclusion.
- [ ] **Grant-Specific Application Draft Customization & Tailored Templates**:
  - Extend `StartApplicationRequest` with `custom_instructions` and tailored template parameters.
  - Support tailored application draft structures customized specifically to the guidelines, work packages, budget rules, and evaluation criteria of individual grant calls.
- [ ] **Google Docs-Style Rich Application Document Editor**:
  - Enhance document canvas into a Google Docs-style paper layout with rich text formatting (styled headings, lists, table callouts, formatting toolbar).
  - Maintain a seamless side-by-side workspace with the Google Docs-style main document canvas on the right and interactive AI side-chat assistant on the left.
- [ ] **Document Attachment & Upload Support**:
  - Enable uploading supporting documents (PDFs, Word docs, organization charts, budget sheets) in the composer.
  - Integrate uploaded document context into Bedrock grant evaluation and proposal drafting prompts.
- [x] **Start / Open Application Button State Handling**:
  - Update "Start Application" button state when an application has been initiated for a grant (e.g. disable button or toggle to "Open Application / Application In Progress").
  - Keep button state synchronized with application status to prevent duplicate application creations.

---

## Areas to Fix / Improve Before Submission

### 🔴 High Priority

- [x] **1. CORS is `allow_origins=["*"]` with no credentials**:
  - Fixed in [`backend/main.py`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/backend/main.py): Replaced hardcoded wildcard `["*"]` with `settings.frontend_cors_origins` and dynamic `allow_credentials` support.
  - Added built-in IP rate limiting middleware (60 req/min) on AI endpoints (`/chat`, `/documents`, `/grants`) to protect against automated spam and Bedrock cost exploitation.
- [x] **2. Pydantic Validation for `save_grant` endpoint**:
  - Added `SaveGrantRequest`, `SavedGrantItem`, and `SavedGrantsListResponse` Pydantic models in [`backend/schemas/grants.py`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/backend/schemas/grants.py).
  - Strongly typed `POST /api/v1/grants/saved` and `GET /api/v1/grants/saved` with full schema validation and interactive Swagger documentation.
- [x] **3. Amazon Bedrock Socket Timeouts & Retry Handling**:
  - Configured `botocore.config.Config(connect_timeout=10, read_timeout=60, retries=...)` in [`ai-agent/tools/config.py`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/ai-agent/tools/config.py) to prevent hanging threads and automatically handle transient 429 throttling.
- [x] **4. True Token Streaming in `rewrite_section_stream`**:
  - Upgraded [`ai-agent/tools/rewrite_section.py`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/ai-agent/tools/rewrite_section.py) to use Bedrock `converse_stream()`, emitting real-time token chunks to the UI.
- [x] **5. Start / Open Application Duplicate Guard**:
  - Synchronized `existingGrantIds` between pipeline applications and active document state to toggle `"Open application"` vs `"Start application"`, preventing accidental duplicate drafts.
- [x] **6. Backend Module Caching in `AgentService`**:
  - Implemented dynamic function caching in [`backend/services/agent_service.py`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/backend/services/agent_service.py) to eliminate repeated `import_module` lookups.
- [x] **7. Frontend Hook Decomposition**:
  - Extracted grant research state machine into [`frontend/src/hooks/useGrantSearch.ts`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/frontend/src/hooks/useGrantSearch.ts) to enhance code modularity.
- [x] **8. Git and Scratch File Hygiene**:
  - Updated `.gitignore` to track only necessary build files and ignore scratch files and temporary runtime databases.

## Completed Tasks [x]

- [x] **Real-Time Token & Live Paragraph Text Streaming**:
  - Implement Amazon Bedrock `converse_stream()` across both Grant Search and Application Document Drafting.
  - Stream live text paragraphs directly into the chat progress card (`DraftProgressCard`) with real-time word count and typing cursor as Bedrock drafts each section.
  - Stream tokens chunk-by-chunk in real time onto the main document editor canvas.
- [x] **Informative Document Generation & Section Streaming**:
  - Upgrade document writing stream UI to replace plain loading spinners with rich, informative progress indicators.
  - Show real-time section-by-section generation progress (e.g., *"Drafting Executive Summary..."*, *"Writing Methodology & Work Packages..."*).
  - Stream preview text section by section so users visually track document creation steps in real-time.
- [x] **Search & Filter in Pipeline Dashboard & Saved Grants Views**:
  - Add search input bars to filter applications in the Kanban Pipeline Dashboard (by grant title, applicant organisation, or status) and Saved Grants list.
  - Implement real-time client-side text filtering and status filter badges so users can quickly locate specific drafts and saved opportunities.
- [x] **Database Persistence for Saved Grants & Match Telemetry**:
  - Add `saved_grants` table in SQLite DB (`platform.db`) and REST API endpoints (`GET/POST/DELETE /api/v1/grants/saved`).
  - Display AI match percentage badges (`★ 85% Match`) and `Why it matches` rationale cards directly on saved grant cards.
- [x] **Fix Search Result Click Routing & Canonical EU Links**:
  - Fix broken EU Portal topic links (`commission.europa.eu/.../data/topicDetails/...`) by constructing canonical URLs (`https://ec.europa.eu/.../topic-details/{topic_id}`). Verified live with HTTP 200 tests.
- [x] **Re-Search / Alternative Grant Generation**:
  - Add functionality allowing users to reject or pass on currently offered grants and request a fresh search with backend exclusion logic.
- [x] **Display Search Diagnostic Telemetry**:
  - Render underlying search parameters, executed queries, active filter tags, and AI search thoughts on the UI.
- [x] **Configurable Local vs. Hosted Session Flag & Container Strategy**:
  - Implement a toggle flag (`SESSION_STORAGE_TYPE=local|hosted`) in `.env` and evaluate session handling for container deployments.
- [x] **PostgreSQL Database Engine & Lightsail Migration**:
  - Integrate SQLAlchemy Core database layer with Alembic schema migrations on backend boot.
  - Fix `DocumentService` and `ChatService` database engine resolution to properly bind to hosted PostgreSQL (`DATABASE_URL`).
  - Add `psycopg2-binary` dependency and URL normalization for production Lightsail deployment.
