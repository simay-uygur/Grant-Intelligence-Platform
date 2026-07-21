# Grant Intelligence

AI-powered chat assistant that helps SMEs, startups, NGOs, universities, research institutions, consultants, and public organisations discover the best European grant opportunities — and prepare an application in the same interface.

## Technologies

- React 19 + TypeScript
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
  services/      GrantIntelligenceService (interface + Mock + Api impls)
  storage/       localStorage adapter
  types/         Strict domain models
  data/          Mock grant catalogue
  utils/         PDF / Word export
  routes/        TanStack Start file routes
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

Environment variables:

- `VITE_API_MODE` — `mock` (default) or `api`. When set to `api`, the app uses `ApiGrantIntelligenceService`, which points at the future FastAPI backend.

## Future FastAPI integration

`ApiGrantIntelligenceService` is stubbed for the following endpoints:

- `POST /api/conversations`
- `POST /api/conversations/{conversationId}/messages`
- `POST /api/grants/search`
- `POST /api/grants/{grantId}/start-application`
- `PATCH /api/documents/{documentId}/sections/{sectionId}`
- `GET  /api/documents/{documentId}/export`

Switch to it by setting `VITE_API_MODE=api` and pointing the fetch base URL at the deployed backend.

## Current limitations

- Frontend only — no persistence beyond the browser, no authentication, no real AI calls.
- Grant data is illustrative demo content, clearly labelled "Demo data" in the UI.
- Rewrite with AI runs a deterministic local simulation.
- PDF export uses the browser print dialog; Word export produces a `.doc` HTML-Word file.
