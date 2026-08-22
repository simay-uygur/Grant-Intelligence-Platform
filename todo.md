# TODO - Grant Intelligence Platform

## Primary Goal

Build a working grant-assistant backend locally first, connect it to the frontend, optimize application document workflows with informative streaming, and prepare for production deployment.

## Active Tasks

- [ ] **Google Docs-Style Rich Application Document Editor**:
  - Enhance document canvas into a Google Docs-style paper layout with rich text formatting (styled headings, lists, table callouts, formatting toolbar).
  - Maintain a seamless side-by-side workspace with the Google Docs-style main document canvas on the right and interactive AI side-chat assistant on the left.
- [ ] **Interactive Q&A for Specific Grant-Tailored Application Document**:
  - Enable targeted Q&A in the chat composer specifically for the active grant-tailored application draft.
  - Allow users to ask questions, request section revisions, or query grant compliance directly against the document context.
- [ ] **Grant-Specific Application Draft Customization & Tailored Templates**:
  - Support tailored application draft structures customized specifically to the guidelines, work packages, budget rules, and evaluation criteria of individual grant calls.
  - Enable users to prompt the agent with specific grant call instructions or custom application document requirements.
- [ ] **Document Attachment & Upload Support**:
  - Enable uploading supporting documents (PDFs, Word docs, organization charts, budget sheets) in the composer.
  - Integrate uploaded document context into Bedrock grant evaluation and proposal drafting prompts.
- [ ] **Start / Open Application Button State Handling**:
  - Update "Start Application" button state when an application has been initiated for a grant (e.g. disable button or toggle to "Open Application / Application In Progress").
  - Keep button state synchronized with application status to prevent duplicate application creations.

---

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
