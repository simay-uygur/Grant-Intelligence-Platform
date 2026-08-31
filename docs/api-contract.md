# API contract notes

This document began as a frontend/backend proposal. The FastAPI backend now
implements the core chat, grant search, application drafting, and application
storage calls; sections that still describe future work are labelled as such.
See `README.md` for the runnable endpoint list.

The team backend is expected to use **FastAPI**. Response shapes below are
written against the existing frontend types in `src/types/index.ts` — reusing
those names should keep the two sides in sync without a separate schema
duplication effort, though the backend team may reasonably prefer different
field names or a normalised (non-flat) shape, especially for
`OrganisationProfile` (see the comment on that type).

## Ground rules carried over from the frontend

- All money/date/duration fields are free-text strings today (e.g.
  `"€500,000 – €1,000,000"`, `"2026-03-15"`), not structured amounts —
  match that unless there's a strong reason to change it, since the frontend
  renders them as-is.
- No auth, no database, no real AI calls are in scope for this document —
  each is a separate, later decision.

## 1. Conversations

Conversations and messages currently live only in the browser
(`useConversations` + `localStorage`). Proposed for when server-side
persistence is wanted:

- `POST /conversations` → creates a `Conversation` (see type), returns it.
- `GET /conversations` → list, for a returning user.
- `GET /conversations/{id}` → one conversation with its messages.
- `PATCH /conversations/{id}` → partial update (title, stage, profile,
  selectedGrantId).
- `DELETE /conversations/{id}`.

## 2. Chat

- `POST /conversations/{id}/messages` → append a `ChatMessage` (user or
  assistant). Request body: `{ role, blocks }`; server assigns `id` and
  `createdAt`.
- Open question for the backend team: do assistant replies come back
  synchronously in the POST response, or does the frontend need to poll /
  subscribe (SSE or WebSocket) for streaming responses? The current mock
  flow assumes a request/response pair per turn, not streaming.

## 3. Research

Maps to `ResearchState/ResearchStep` and the `research_status` block.

- `POST /research` → `{ profile: OrganisationProfile }` → starts a research
  session, returns a session id.
- `GET /research/{sessionId}` → current `ResearchState` (for polling), or a
  streaming/SSE variant if the backend wants to push step updates instead of
  the frontend polling.
- The mock's 7 fixed step labels (`RESEARCH_STEPS` in `App.tsx`) are
  frontend-only today; a real backend may return its own step labels, in
  which case the frontend would render whatever labels arrive rather than
  the hardcoded list.

## 4. Grant results

Already partly stubbed in `ApiGrantIntelligenceService.searchGrants`:

- `POST /grants/search` → `{ profile: OrganisationProfile }` → `Grant[]`.
- `GET /grants/{id}` → single `Grant`. **Not yet in the service interface** —
  this is the endpoint that would replace the local-catalogue fallback
  currently in `App.tsx`'s `getGrantById` (see the `TODO(api)` comment
  there). Adding it will require `getGrantById` to become async and its
  callers to handle a loading state — a real behavioural change, intentionally
  not made yet.

## 5. Applications

Implemented with the SQLite database configured by `SQLITE_DB_PATH`:

- `POST /api/v1/grants/{grantId}/start-application` accepts `{ grant, profile }`,
  returns the existing `ApplicationDocument` shape, and persists the generated
  draft.
- `GET /api/v1/grants/{grantId}/applications/latest` returns the latest
  non-archived application linked by `grantId`. The normal chat uses this before
  starting generation, preventing duplicate drafts when the user clicks the
  same grant again.
- `GET /api/v1/applications` returns dashboard summaries ordered by most recent
  update. Optional query parameters: `status=draft|completed|archived`, `limit`,
  and `offset`.
- `GET /api/v1/applications/{applicationId}` returns the complete stored output,
  lifecycle status, and the grant/profile generation context.
- `PATCH /api/v1/applications/{applicationId}` accepts
  `{ "status": "draft|completed|archived" }`.
- `PUT /api/v1/applications/{applicationId}/sections/{sectionId}` accepts
  `{ "content": "..." }` for manual edits.
- `PATCH /api/v1/documents/{documentId}/sections/{sectionId}` runs the current AI
  rewrite flow and updates the stored section when the document exists.

PDF/DOCX export remains client-side in `frontend/src/utils/export.ts`. A future
server-side or S3-backed export endpoint can be added without changing the
stored application contract.

The current MVP has no authentication, so application records are scoped to the
configured SQLite database rather than to an individual user. Multi-user
deployment requires an owner/user identifier and authorization checks on these
routes.

## 6. File upload

Server-side document upload is available for applicant background material.

- `POST /api/v1/documents/upload` accepts multipart form data with `file`,
  plus optional `conversation_id` and `application_id`.
- Supported parser formats: `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.json`.
- The backend stores extracted text and metadata, not the original file bytes.
- Uploaded conversation documents can inform chat answers, outline generation,
  and application drafting. Uploaded application documents can inform document
  Q&A.
- The response shape is `{ id, filename, contentType, characterCount,
  textSnippet, applicationId, conversationId, uploadedAt }`.

## 7. Voice transcription

Currently 100% client-side via the browser's Web Speech API
(`src/hooks/useSpeechRecognition.ts`) — no network call, no server
involvement. If the team later wants server-side transcription (better
accuracy, browser-independent, non-English support beyond what Web Speech
offers):

- `POST /transcribe` (multipart audio, e.g. webm/opus) → `{ transcript:
string }`.
- This is **not a drop-in replacement** for `useSpeechRecognition` — it
  needs a different hook that records audio (`MediaRecorder`) and awaits a
  response, rather than streaming interim results from the browser. As long
  as the replacement hook exposes the same
  `state`/`start`/`stop`/`onResult`-shaped API, `Composer.tsx` shouldn't need
  to change.

## Out of scope here

Authentication, database choice, and real AI/LLM integration are explicitly
excluded from this document — each needs its own decision and isn't assumed
by anything above.
