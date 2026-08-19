# Backend API Documentation

The Grant Intelligence Platform backend is a FastAPI service that orchestrates chat conversations, grant searches via the EU Funding & Tenders Portal, application drafting via Amazon Bedrock (Anthropic Claude), and SQLite persistence.

---

## Interactive API Documentation

When the backend server is running locally on `http://localhost:8000`:

* **Swagger UI (Interactive):** [`http://localhost:8000/docs`](http://localhost:8000/docs)
* **ReDoc (Detailed Specs):** [`http://localhost:8000/redoc`](http://localhost:8000/redoc)
* **OpenAPI JSON Schema:** [`http://localhost:8000/openapi.json`](http://localhost:8000/openapi.json)

---

## Endpoint Reference

### 1. Authentication
* `POST /api/v1/auth/register` — Register a new user account. Accepts email and password.
* `POST /api/v1/auth/login` — Authenticate and receive a session bearer token.
* `GET /api/v1/auth/me` — Retrieve the currently authenticated user profile.

### 2. Chat & Orchestration
* `POST /api/v1/chat/conversations` — Initialize a new chat session.
* `POST /api/v1/chat/message` — Append user message and retrieve assistant response.
* `GET /api/v1/chat/conversations/{conversation_id}/messages` — Fetch message history for a conversation.

### 3. Grant Discovery & Matching
* `POST /api/v1/grants/search` — Synchronous grant search and ranking against an organization profile.
* `POST /api/v1/grants/search/stream` — Real-time Server-Sent Events (SSE) stream emitting thinking, keyword generation, search, and selection events.

### 4. Application Drafting & Section Rewriting
* `POST /api/v1/grants/{grant_id}/start-application` — Draft a full application document and persist to database.
* `POST /api/v1/grants/{grant_id}/start-application/stream` — Real-time SSE stream drafting sections and storing the completed application document.
* `PATCH /api/v1/documents/{document_id}/sections/{section_id}` — Synchronous AI rewrite of an application section.
* `PATCH /api/v1/documents/{document_id}/sections/{section_id}/stream` — Real-time SSE stream for section rewriting, updating the stored section in the database.

### 5. Application Storage & Management
* `GET /api/v1/applications` — List saved applications with optional status filtering (`drafting`, `submitted`, `approved`, `rejected`, `archived`).
* `GET /api/v1/applications/{application_id}` — Fetch a complete application document with grant/profile context.
* `PATCH /api/v1/applications/{application_id}` — Update an application's lifecycle status.
* `PUT /api/v1/applications/{application_id}/sections/{section_id}` — Save manual section edits.
* `GET /api/v1/grants/{grant_id}/applications/latest` — Retrieve the latest active draft associated with a grant ID.

### 6. System & Metadata
* `GET /api/v1/health` — Service health check.
* `GET /api/v1/meta/frontend-config` — Discover backend configuration and enabled features.
