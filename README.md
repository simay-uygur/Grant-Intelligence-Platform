# Grant Navigator (frontend)

Grant Navigator is a chat-first frontend that walks an organisation through a
three-step profile, then simulates matching, researching, and drafting a
grant application in the same conversation. In-app it is currently labelled
"Grant Intelligence"; both names refer to this same project.

This project currently runs **locally only**. Grant research, matching, and
"Rewrite with AI" are all handled by a local mock service — there is no
deployed backend, no live grant database, and no third-party AI API is called.
Backend and agent integration are planned but not yet implemented.

## Technologies

- React 19 + TypeScript
- Bun (package manager and script runner)
- Vite + TanStack Router (single-page app; only the `/` route is used)
- Tailwind CSS v4
- lucide-react icons, date-fns
- No backend, no auth, no Redux, no AI API keys in the frontend

## Project structure

```
src/
  components/
    layout/      Sidebar
    chat/        MessageList, Composer, BlockRenderer
    widgets/     OrganisationForm, ResearchStatus
    grants/      GrantResults (card grid)
    documents/   ApplicationDocument (editable sections + export)
    ui/          shadcn primitives
    App.tsx      Orchestrator (single screen)
  hooks/         useConversations
  services/      GrantIntelligenceService (interface + Mock + Api impls), apiClient (fetch boundary)
  storage/       localStorage adapter
  types/         Strict domain models
  data/          Mock grant catalogue
  utils/         PDF / Word export
  routes/        TanStack Start file routes
docs/            api-contract.md — draft backend integration proposal
```

## Install & run

```
bun install
bun run dev       # http://localhost:8080
bun run build     # production build
bun run preview   # preview production build
bun run lint
```

## Mock mode

The app ships in mock mode. All grant data, research and rewrite calls are handled locally by `MockGrantIntelligenceService`, and everything is persisted in `localStorage`.

File attachments can be selected locally from the composer (PDF, DOC, DOCX,
TXT, MD, PNG, JPG, JPEG). The selected file is shown as a chip for the user's
own reference only — it is **not uploaded, parsed, or analysed**; there is no
backend to send it to yet.

Environment variables (see `.env.example`):

- `VITE_API_MODE` — `mock` (default) or `api`. When set to `api`, the app uses `ApiGrantIntelligenceService`, which points at a **future, not-yet-built** FastAPI backend. Mock mode never makes a network request.
- `VITE_API_URL` — base URL for that future backend (e.g. `http://localhost:8000`). Only read when `VITE_API_MODE=api`.

## Planned backend and agent integration (not yet implemented)

`ApiGrantIntelligenceService` (in `src/services/`) is a stub implementing the
same `GrantIntelligenceService` interface as the mock, built on a small
shared fetch boundary (`src/services/apiClient.ts`) so a real backend only
needs to be wired in one place. None of its endpoints exist yet:

- `POST /grants/search`
- `POST /grants/{grantId}/start-application`
- `POST /documents/{documentId}/sections/{sectionId}/rewrite` (not yet stubbed — currently throws)

See **`docs/api-contract.md`** for the fuller, still-draft proposal covering
conversations, chat, research, grant results, applications, file upload, and
voice transcription — including which parts are already partly stubbed and
which need new endpoints entirely.

Once a real backend exists, switch to it by setting `VITE_API_MODE=api` and
`VITE_API_URL` to the deployed backend's base URL. Until then, setting
`VITE_API_MODE=api` will point the app at endpoints that do not exist.

## Current limitations

- Frontend only — no persistence beyond the browser, no authentication, no real AI calls, no live grant database.
- Grant data is illustrative demo content, clearly labelled "Demo data" in the UI.
- Rewrite with AI runs a deterministic local simulation, not a real model call.
- Attached files are selected locally only; they are not uploaded, stored, or processed.
- PDF export uses the browser print dialog; Word export produces a `.doc` HTML-Word file.
