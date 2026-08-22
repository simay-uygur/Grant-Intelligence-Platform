# TODO - Grant Intelligence Platform

## Primary Goal

Build a working grant-assistant backend locally first, connect it to the frontend, optimize application document workflows with informative streaming, and prepare for production database and storage deployment on AWS.

## Must Do First

- [ ] Make the current FastAPI backend run reliably on local machines.
- [ ] Confirm the local development baseline:
  - Python version to standardize on for backend work.
  - `.env` setup.
  - dependency install flow.
  - local run command.
- [x] Replace the current stub grant search source with at least one real external API or web data integration.
- [x] Define the first backend API contract needed by the frontend.
- [x] Connect frontend to backend with at least one working end-to-end flow.
- [x] Add a minimal AI-agent call path that can converse and trigger tools through a backend-managed Bedrock loop.
- [ ] Dockerize the backend local setup.

## Database Migration & Managed Infrastructure

- [ ] **Research Hosted Database Alternatives**:
  - Evaluate cloud database options (AWS RDS PostgreSQL/MySQL, AWS Lightsail Managed Database, Supabase, Neon) to replace the current SQLite database stored locally inside container storage (`/app/storage/backend.db`).
  - Compare cost, maintenance overhead, performance, and ease of automated backups.
- [ ] **Migrate Database to Remote Host**:
  - Update backend database configuration (`DATABASE_URL`) to point to the external deployed database host.
  - Ensure all business logic, queries, and API endpoints retain 100% same functionality while connecting to the external database host.
  - Add connection pooling, environment configuration, and migration scripts (e.g. Alembic).

## Application Document Management & Editor UI

- [ ] **Research Google Sheets-Style Document Editor**:
  - Investigate frontend grid/spreadsheet and rich document editor libraries (e.g., FortuneSheet, Handsontable, AG Grid, or custom rich document tables) suitable for grant application draft editing.
  - Design a side-by-side layout with a Google Sheets-style main document canvas and an interactive AI side-chat assistant.
- [x] **Informative Document Generation & Section Streaming**:
  - Upgrade document writing stream UI to replace plain loading spinners with rich, informative progress indicators.
  - Show real-time section-by-section generation progress (e.g., *"Drafting Executive Summary..."*, *"Writing Methodology & Work Packages..."*, *"Calculating Budget Breakdown..."*).
  - Stream preview text section by section so users visually track document creation steps in real-time.
- [x] **Real-Time Token Streaming & Rich Sub-Step Progress**:
  - Implement Amazon Bedrock `converse_stream()` across both Grant Search and Application Document Drafting.
  - Stream tokens chunk-by-chunk in real time onto the document editor canvas.
  - Display animated AI thoughts (e.g., 🧠 *"Analyzing eligibility rules..."*) and real-time word counter in `DraftProgressCard`.
- [ ] **Interactive Q&A for Specific Grant-Tailored Application Document**:
  - Enable targeted Q&A in the chat composer specifically for the active grant-tailored application draft.
  - Allow users to ask questions, request section revisions, or query grant compliance directly against the document context.
- [ ] **Document Attachment & Upload Support**:
  - Enable uploading supporting documents (PDFs, Word docs, organization charts, budget sheets) in the composer.
  - Integrate uploaded document context into Bedrock grant evaluation and proposal drafting prompts.

## Session Storage Management & Environment Configuration

- [x] **Containerized Session Storage Strategy**:
  - Evaluate session handling for container deployments (preventing lost sessions during Lightsail container restarts).
- [x] **Configurable Local vs. Hosted Session Flag**:
  - Implement a toggle flag (e.g. `SESSION_STORAGE_TYPE=local|hosted` or `USE_HOSTED_SESSION=true/false`) in `.env`.
  - Support `local` (in-memory / browser session) for local testing and `hosted` (database / Redis backed) for deployed environments.

## Grant Search & Navigation Enhancements

- [ ] **Fix Search Result Click Routing / Blank Page Error**:
  - Investigate bug where clicking the first search result / grant item shows nothing or throws an error when attempting to route to the website.
  - Implement robust navigation error handling, link verification, and fallback error UI boundaries.
- [ ] **Re-Search / Alternative Grant Generation**:
  - Add functionality allowing users to reject or pass on currently offered grants and request a fresh search.
  - Implement backend exclusion logic to filter out previously offered grant IDs and retrieve new/alternative grant opportunities.
- [ ] **Display Search Diagnostic Telemetry**:
  - Render underlying search parameters, executed queries, active filter tags, and AI search thoughts on the UI so users can see how grant search results were retrieved.

## Frontend UI & Button State Logic

- [ ] **Search & Filter in Pipeline Dashboard & Saved Grants Views**:
  - Add search input bars to filter applications in the Kanban Pipeline Dashboard (by grant title, applicant organisation, or status) and Saved Grants list.
  - Implement real-time client-side text filtering and status filter badges so users can quickly locate specific drafts and saved opportunities.
- [ ] **Start / Open Application Button State Handling**:
  - Note: Update "Start Application" button state when an application has been initiated for a grant (e.g. disable button or toggle to "Open Application / Application In Progress").
  - Keep button state synchronized with application status to prevent duplicate application creations (to be integrated cleanly with backend status).

## Backend Priorities

### 1. Local Backend Foundation

- [ ] Verify project boot sequence and health endpoints.
- [ ] Add a simple `/health` or `/status` endpoint if missing.
- [ ] Clean up config so local setup is predictable.
- [ ] Decide the backend Python version for the team.
- [ ] Document local startup clearly.

### 2. Real Data Integrations

- [ ] Identify the first real grant-related data sources to integrate.
- [ ] Implement one source fully before adding multiple sources.
- [ ] Normalize external results into one internal grant schema.
- [ ] Add basic error handling, timeouts, and fallback behavior for source failures.
- [ ] Keep integrations modular so more APIs can be added later.

### 3. Tooling Layer

- [ ] Define what “tools” mean in the backend:
  - search grants
  - fetch grant details
  - filter by grant type
  - filter by preferences
  - summarize requirements
- [ ] Treat tool support as top priority because the AI layer will depend on it.
- [ ] Design tool endpoints or tool-call handlers so the AI service can invoke them cleanly.
- [ ] Keep EU Horizon tool functions reusable so the same handlers can support both current local orchestration and any later agent-style flow.

### 4. SOP / Knowledge Flow

- [ ] Clarify what SOP means in this project:
  - standard workflow for answering user questions
  - grant type classification
  - preference-based filtering
  - requirements/spec extraction
- [ ] Turn SOP into backend logic or structured prompts, not just notes.
- [ ] Decide what should be code logic vs AI prompt logic.

### 5. Frontend Integration

- [ ] Define the minimum UI flow for this week:
  - user enters question
  - backend receives request
  - Bedrock decides whether a tool should be called
  - backend executes the requested tool
  - results return to UI
- [ ] Confirm request/response schemas with the frontend side.
- [ ] Add CORS/config needed for local frontend-backend communication.
- [ ] After the first end-to-end integration works, split the current frontend service interface by domain as the API grows:
  - `grantService` for grant search and grant details
  - `chatService` for conversations and messages
  - `applicationService` for starting applications, saving sections, and rewrites
- [ ] Keep components behind these stable frontend interfaces and map backend request/response DTOs inside API adapters.

## Docker Tasks

- [ ] Dockerize the backend.
- [ ] Decide whether to start with:
  - one backend container only
  - or separate containers for backend plus supporting services
- [ ] Recommendation for now: start with a single backend container, then split only if a real need appears.
- [ ] Add `docker-compose.yml` only if it helps local development immediately.
- [ ] Keep the first Docker setup minimal and focused on local reproducibility.

## Storage Tasks

- [ ] Start with small local storage only during local dev.
- [ ] Evaluate SQLite for:
  - saving conversations
  - caching fetched grant results
  - storing lightweight metadata
- [ ] Prepare migration path to managed host DB (AWS RDS / Lightsail DB).

## AI Integration Tasks

- [ ] Coordinate with the AI-side work being done with Amazon Bedrock.
- [ ] Keep backend tool contracts stable so the AI layer can call them.
- [ ] Support local execution first even if Bedrock is used later.
- [ ] Bedrock loop flow:
  - send user prompt
  - Bedrock receives tool definitions
  - model decides whether a tool call happens
  - backend executes the selected tool
  - response comes back to UI
- [ ] Start Bedrock integration with our own loop-calling approach before considering managed agent infrastructure.

## Suggested Execution Order

1. Make local backend setup reliable.
2. Implement one real grant/API integration.
3. Define tool interfaces for the AI layer.
4. Connect frontend to backend locally.
5. Add one working conversational AI flow & document section streaming.
6. Dockerize local stack & implement session storage toggle flag (`local` vs `hosted`).
7. Research and migrate to deployed database (AWS RDS / Lightsail Managed DB).
