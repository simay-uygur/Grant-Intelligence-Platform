# API contract proposal (draft)

This is a **proposal**, not a finalised contract — it exists so the frontend
and backend teams have a shared starting point to negotiate from. Nothing
described here is implemented; no backend exists yet, and this document does
not change that. See `README.md` for the current mock-only state, and
`src/services/ApiGrantIntelligenceService.ts` for the (also stub) client
side.

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

Already stubbed in `ApiGrantIntelligenceService`:

- `POST /grants/{grantId}/start-application` → `{ profile }` →
  `ApplicationDocument`.
- `PATCH /documents/{documentId}/sections/{sectionId}` → `{ content }` →
  updated `DocumentSection`. (Frontend today calls
  `onSectionChange`/`updateDocumentSection` purely locally — see
  `useConversations.ts`.)
- `POST /documents/{documentId}/sections/{sectionId}/rewrite` → `{
currentContent, profile, grant }` → `{ content: string }`. Replaces
  `MockGrantIntelligenceService.rewriteSection`; `ApiGrantIntelligenceService`
  currently throws for this on purpose (fails loudly rather than pretending
  to work) until it exists.
- `GET /documents/{documentId}/export?format=pdf|docx` — the frontend
  currently generates both exports client-side
  (`src/utils/export.ts`); this would only be needed if that moves
  server-side (e.g. for higher-fidelity Word/PDF output).

## 6. File upload

Not modelled at all server-side today — attachments are select-only, never
uploaded (`Composer.tsx`, and see the `Attachment` type added to
`src/types/index.ts` ahead of this work). Proposed:

- `POST /conversations/{id}/attachments` (multipart) → `Attachment`
  (`{ id, filename, mimeType, sizeBytes, status }`).
- `GET /attachments/{id}` — for showing status/retrieving after upload.
- Open question: are attachments parsed/analysed server-side (the honesty
  copy in `Composer.tsx` currently tells the user they aren't), or just
  stored and attached to the application PDF as-is? This changes whether a
  `status: "uploading" | "uploaded" | "failed"` is enough or a processing
  state needs adding.

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
