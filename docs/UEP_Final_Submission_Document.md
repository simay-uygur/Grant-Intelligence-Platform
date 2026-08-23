# University Engagement Program 5.0
## Final Submission Template Document

**Project Title:**  
Grant Intelligence Platform

**Team Name:**  
Grant Intelligence Team (UEP 5.0)

**Team Members:**
* **Dea Berisha** — Student ID: `[Enter Student ID]` — Email: `[Enter Email]`
* **Bleron Bajraktari** — Student ID: `[Enter Student ID]` — Email: `[Enter Email]`
* **Simay Uygur** — Student ID: `[Enter Student ID]` — Email: `[Enter Email]`

---

## 1. Final Report

It must include the following sections:

### • Project Overview:
Provide a brief, clear description of what your project is, what it does, and who it is intended for.

The **Grant Intelligence Platform** is an intelligent, AI-powered cloud platform designed to automate and streamline the entire lifecycle of grant discovery, eligibility matchmaking, and application drafting for small and medium-sized enterprises (SMEs), university researchers, non-profits, and tech startups. Powered by **Amazon Bedrock** (Anthropic Claude 3.5 Sonnet / Claude Sonnet 4.6), the platform bridges non-repayable public/private grant funding with innovators by translating complex grant guidelines, Standard Operating Procedures (SOPs), and eligibility rules into an intuitive conversational discovery experience and automated, section-by-section proposal generator.

---

### • Problem Statement
Clearly state the specific problem or gap your project addresses. Answer: What issue exists? Who is affected? Why does it matter?

* **What issue exists?**  
  Every year, billions of dollars in non-repayable public and private grants (such as the EU Horizon Europe program, national research councils, and private foundations) go unallocated or are disproportionately claimed by large corporations with dedicated grant consultancy departments. Finding relevant grants requires sifting through hundreds of convoluted portals, while preparing compliance-heavy proposals demands dozens of hours of specialized legal and technical writing.
* **Who is affected?**  
  Early-stage startups, university research teams, non-profits, and SMEs who have high-potential innovations but lack dedicated grant-writing staff or the budget to hire external grant consultants charging high retainers.
* **Why does it matter?**  
  Bureaucratic friction creates an artificial barrier to innovation. High-potential scientific and technological projects fail to launch simply because innovators cannot navigate dense administrative requirements. Democratizing grant intelligence levels the playing field and accelerates impactful research and technology adoption.

---

### • Solution Overview:
Describe your solution and how it directly addresses the problem stated above. Explain the core value it delivers to the user.

The **Grant Intelligence Platform** delivers an end-to-end, automated AI agent workflow:
1. **Live Grant Discovery & Semantic Filtering:** Connects directly with official funding registries (including the **EU Funding & Tenders / Horizon API**) to find active funding opportunities matched to an applicant's organizational profile and technical capabilities.
2. **Context-Aware Matchmaking & Scoring:** Autonomously analyzes grant eligibility criteria against the user's organization profile, calculating compatibility scores, flagging prerequisites, and highlighting strategic advantages.
3. **Structured, Section-by-Section Proposal Drafting:** Automatically translates grant call requirements into fully articulated application drafts across essential sections (Project Objectives, Impact & Dissemination, Budget Rationale, Implementation Plan), cutting proposal drafting time from weeks to hours.
4. **Interactive Human-in-the-Loop Refinement & Instant Export:** Enables users to interactively instruct the AI to rewrite specific sections (*"Make this more technical"*, *"Emphasize commercialization readiness"*) with real-time streaming feedback, culminating in one-click exports to **Direct Vector PDF** and **Native Microsoft Word (`.docx`)** formats.

---

### • Development Process:
Summarize how your team approached the project. Include:
* The development methodology used (e.g., Agile, waterfall, iterative sprints)
* Key milestones or phases (e.g., design, development, testing, deployment)

* **Development Methodology:**  
  The team adopted an **Agile / Iterative Sprint Methodology** governed by a **Local-First Development Philosophy**. The system was broken into four independent yet tightly coordinated layers: AI Agent / Tooling Layer, FastAPI Backend Layer, React 19 Frontend UX, and DevOps / AWS Cloud Infrastructure. Iterative 1-to-2 week sprints enabled rapid prototyping, safe local unit/integration testing, and continuous cloud deployments.

* **Key Milestones and Phases:**
  * **Phase 1: Foundation, Schemas & Local Baseline (Weeks 1–3):**  
    Established repository structure, defined FastAPI REST API schemas (Pydantic v2), built the local mock data layers, and created the frontend UI layout.
  * **Phase 2: Data Integrations & Bedrock Agent Loop (Weeks 4–6):**  
    Integrated live grant sources (EU Horizon API) and connected **Amazon Bedrock** (Claude 3.5 Sonnet) using Model Context Protocol (MCP) in-process tool loops for autonomous multi-step reasoning.
  * **Phase 3: Multi-Container Architecture & Cloud Deployment (Weeks 7–8):**  
    Containerized the entire stack into a 3-container topology (`nginx`, `frontend`, `backend`). Implemented GitHub Actions CI/CD workflows targeting **Amazon Lightsail Container Services** with staging (`develop`) and production (`main`) pipelines.
  * **Phase 4: SSE Streaming, Persistence, Telemetry & Polishing (Weeks 9–10):**  
    Implemented real-time Server-Sent Events (SSE) streaming (`DraftProgressCard`), environment mode scripts (`set_env_mode.sh`), SQLite/hosted persistence, and native `.docx`/PDF export engines.

---

### • Technical Stack:
List all technologies, frameworks, languages, and tools used in your project.

| Category | Technology / Tool |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Bun Runtime, Vite, TanStack Router / TanStack Start, Tailwind CSS v4, Radix UI Primitives, shadcn/ui, Lucide Icons |
| **Backend** | Python 3.11+ / 3.13, FastAPI Framework, Pydantic v2, `pydantic-settings`, Uvicorn ASGI Server, HTTPX, Server-Sent Events (SSE) Streaming Engine |
| **Database** | SQLite (Local Development & Session Storage), PostgreSQL / AWS RDS Managed Database Support, Persistent Disk Volumes |
| **Hosting / Deployment** | Amazon Lightsail Container Services (Multi-container: Nginx Reverse Proxy + React Frontend + FastAPI Backend), Docker, Docker Compose, GitHub Actions CI/CD |
| **Version Control** | Git, GitHub (Dual-branch CI/CD: `main` for Production, `develop` for Staging) |
| **Other Tools** | Amazon Bedrock (Anthropic Claude 3.5 Sonnet / Claude Sonnet 4.6), Model Context Protocol (MCP), AWS SDK (`boto3`), EU Funding & Tenders Portal API, Pytest, Playwright E2E, Vitest / Bun Test, jsPDF, `docx` Library, Postman |

---

### • Architectural Design Diagram:
Provide a diagram illustrating how the components of your system are structured and interconnected.
* Include frontend, backend, database, and any external APIs or services.
* Clearly label each component and the direction of data flow between them.
* If a diagram is not yet available, include a written description of the architecture in its place.

#### 1. Visual System Architecture Diagram

```
                                  ┌───────────────────────────────────────────────┐
                                  │         Client Web Browser (End User)         │
                                  └───────────────────────────────────────────────┘
                                                         │
                                                         │ HTTPS / Port 80 (HTTP)
                                                         ▼
                                  ┌───────────────────────────────────────────────┐
                                  │         NGINX Container (Reverse Proxy)       │
                                  └───────────────────────────────────────────────┘
                                         │                                │
                       Route: `/*`       │                                │ Route: `/api/*`
                                         ▼                                ▼
                  ┌───────────────────────────────┐     ┌───────────────────────────────────┐
                  ║      Frontend Container       ║     ║      FastAPI Backend Container    ║
                  ║  (React 19 + TanStack + Bun)  ║     ║       (Python 3.11+ / Uvicorn)    ║
                  ║          Port: 3000           ║     ║              Port: 8000           ║
                  └───────────────────────────────┘     └───────────────────────────────────┘
                                                                          │
                                       ┌──────────────────────────────────┴──────────────────────────────────┐
                                       │                                                                     │
                                       ▼                                                                     ▼
                        ┌───────────────────────────────┐                             ┌───────────────────────────────────┐
                        │   Persistence / Storage Layer │                             │          AI Agent Layer           │
                        │  - SQLite / AWS RDS Database  │                             │  (Dynamic `agent_service.py`)     │
                        │  - Application Store & Drafts │                             └───────────────────────────────────┘
                        │  - Centralized File Logging   │                                              │
                        └───────────────────────────────┘                                              ▼
                                                                                      ┌───────────────────────────────────┐
                                                                                      │       Amazon Bedrock Engine       │
                                                                                      │  - Claude 3.5 Sonnet Foundation   │
                                                                                      │  - MCP Tool Orchestration         │
                                                                                      │  - Real-time SSE Token Streaming  │
                                                                                      └───────────────────────────────────┘
                                                                                                       │
                                                                                                       ▼
                                                                                      ┌───────────────────────────────────┐
                                                                                      │    External Tool Integrations     │
                                                                                      │   - EU Horizon & Tenders API      │
                                                                                      │   - Web Search & Retrieval Tools  │
                                                                                      └───────────────────────────────────┘
```

#### 2. Written Architecture Description & Key Engineering Highlights:

* **Clear 3-Layer Separation (Frontend → FastAPI Backend → AI Agent Layer):**  
  The system enforces clean, logical decoupling across three distinct layers:
  1. *Presentation Layer (Frontend):* Responsive React 19 UI handling user interactions, Kanban pipeline cards, and real-time SSE stream consumption.
  2. *API & Orchestration Layer (FastAPI Backend):* Serves as the single secure control boundary. It manages authentication, input validation (Pydantic v2), CORS, persistent session storage, and centralized error logging. The frontend never accesses AWS credentials directly.
  3. *AI Agent & Reasoning Layer (`ai-agent`):* Contains prompt chains, context assemblers, and Model Context Protocol (MCP) in-process tool loops powered by Amazon Bedrock.

* **Dynamic Module Loading in `agent_service.py`:**  
  Inside [`backend/services/agent_service.py`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/backend/services/agent_service.py), the backend implements dynamic module resolution (`importlib.import_module("agent.service")`). This enables the AI agent module to be swapped, updated, or mocked on the fly without modifying or breaking the core API layer.

* **Dual-Mode Support (Mock Mode vs. Live Bedrock Mode):**  
  The platform includes robust dual-mode capabilities:
  * *Mock Mode:* Runs completely locally with SQLite and fast synthetic agent simulations—ideal for rapid UI development, offline testing, and cost-free demonstrations.
  * *Live Mode:* Connects directly to **Amazon Bedrock** (Claude 3.5 Sonnet) and external grant APIs for production workloads.
  * Toggling is seamlessly controlled via environment flags (`USE_MOCK_BEDROCK`, `SESSION_STORAGE_TYPE`, `VITE_API_MODE`) and automated via [`scripts/set_env_mode.sh`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/scripts/set_env_mode.sh).

* **SSE Streaming Architecture:**  
  Real-time token and progress streaming from Amazon Bedrock → SSE (`text/event-stream`) → Frontend delivers instant, transparent feedback. As the AI reasons, fetches grants, and drafts sections, the UI renders live percentage updates, active section pills, and text chunks sequentially, exceeding typical university MVP benchmarks.

---

### • Features Implemented:
List the main features your project includes, with a short description of each.

* **[Feature 1: Context-Aware Semantic Grant Search & EU Horizon Discovery]:**  
  Connects to the official EU Funding & Tenders API with Claude 3.5 Sonnet query expansion, filtering opportunities by funding type, deadlines, budget thresholds, and technical compatibility.
* **[Feature 2: Automated Matchmaking & Eligibility Scoring]:**  
  Evaluates organization profiles against complex call criteria, generating match percentages, prerequisite alerts, and strategic alignment insights.
* **[Feature 3: Interactive Section-by-Section AI Application Drafting]:**  
  Generates complete, structured grant proposals across critical sections (Project Summary, Excellence & Innovation, Impact, Work Packages, Budget) strictly aligned with official guidelines.
* **[Feature 4: Real-Time SSE Progress Streaming (`DraftProgressCard`)]:**  
  Provides transparent, live visual feedback during AI execution with an animated progress bar, percentage counter, active section badges, and live token chunk streaming.
* **[Feature 5: Application Pipeline Kanban Dashboard & Saved Grants Shortlist]:**  
  Full lifecycle grant tracking board (`Drafting`, `Submitted`, `Approved`, `Rejected`, `Archived`) featuring drag-and-drop status changes, application deletion, and fallback chat navigation.
* **[Feature 6: Multi-Format Document Export (Direct Vector PDF & Native Word `.docx`)]:**  
  Allows instant one-click download of drafted proposals as professionally formatted Vector PDF or native Microsoft Word (`.docx`) files.
* **[Feature 7: Multi-Environment Mode Selector (`set_env_mode.sh`)]:**  
  A developer and demo utility supporting single-command toggling across all 4 frontend/backend environment configurations (`--both-local`, `--both-deployed`, `--fe-local-db-deployed`, `--fe-deployed-db-local`).

---

### • Challenges Faced & Solutions:
Describe 2–3 significant challenges your team encountered during development and how you resolved each one.

#### Challenge 1: Container Data Ephemerality & Session Persistence in Stateless Cloud Deployments
* **Description:**  
  In **Amazon Lightsail Container Services**, container instances are stateless by default. Each automated deployment or rolling service restart recreated the backend container, wiping the local SQLite database (`storage/backend.db`), resulting in lost user sessions, custom profiles, and draft applications.
* **Solution:**  
  We built a modular storage abstraction layer governed by `SESSION_STORAGE_TYPE` (`local` vs. `hosted`), supporting seamless switching between local SQLite files and remote PostgreSQL / AWS RDS instances. Additionally, we implemented volume mounting (`/app/storage`) and automated replication configurations to guarantee data survival across deployments.

#### Challenge 2: Decoupled Multi-Environment Configuration & Safe Local/Cloud Testing
* **Description:**  
  Managing different development configurations across the team (offline frontend mock testing, local backend debugging, and full cloud API integration testing with real Bedrock) led to frequent manual `.env` file edits and configuration errors.
* **Solution:**  
  Developed [`scripts/set_env_mode.sh`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/scripts/set_env_mode.sh), an automated CLI script that synchronizes `VITE_API_MODE`, `VITE_API_URL`, `AUTH_REQUIRED`, and `USE_MOCK_BEDROCK` across all 4 environment permutations with built-in validation checks.

#### Challenge 3: Real-Time AI Execution Feedback & Long-Running Tool Latency
* **Description:**  
  Querying external APIs and generating 1,500+ word multi-section proposals via Amazon Bedrock can take 15 to 45 seconds. Synchronous HTTP request/response models caused perceived UI freezes, browser timeout risks, and poor user experience.
* **Solution:**  
  Implemented an asynchronous Server-Sent Events (SSE) streaming architecture (`backend/core/sse.py`). The backend emits structured lifecycle events (`ThinkingStep`, tool execution, and section chunks), and the frontend renders the interactive `DraftProgressCard` component with live animated progress bars and streaming text.

---

### • Team Contributions:
Summarize each team member's role and responsibilities.

* **Dea Berisha — AI Agent Architecture & Cloud AI Integration:**
  * Led the integration with **Amazon Bedrock** and Anthropic Claude 3.5 Sonnet foundation models.
  * Designed Model Context Protocol (MCP) in-process tool loops for autonomous grant search and proposal generation.
  * Developed prompt templates, system instructions, and dynamic keyword extraction routines for the EU Horizon API.
  * Contributed to the design and testing of agent streaming generators in `ai-agent/agent/service.py`.

* **Bleron Bajraktari — Frontend Architecture & Interactive UI/UX:**
  * Architected the **React 19 + TypeScript + TanStack Router** single-page application using Tailwind CSS v4 and Radix UI / shadcn.
  * Built the interactive **Pipeline Kanban Dashboard** with status synchronization, card animations, and delete flows.
  * Implemented the **Draft Document Editor**, live SSE stream consumption hooks (`useDrafts.ts`), and `DraftProgressCard`.
  * Developed the multi-format export utility supporting direct vector PDF and native Microsoft Word (`.docx`) file generation.

* **Simay Uygur — Backend Platform, API Architecture & DevOps/Cloud Infrastructure:**
  * Designed and implemented the core **FastAPI backend**, standardized REST endpoints, Pydantic schemas, and global error handlers.
  * Built the dynamic module-loading **`AgentService`** facade (`backend/services/agent_service.py`) and SSE streaming engine (`backend/core/sse.py`).
  * Engineered the multi-container Docker stack (`nginx`, `frontend`, `backend`) and automated GitHub Actions CI/CD deployment to **Amazon Lightsail Container Services**.
  * Developed the multi-environment toggle automation scripts (`set_env_mode.sh`, `run_dev.sh`) and led end-to-end testing (Pytest, Playwright).

---

## 2. Final Code Submission

**GitHub Repository Link:**  
[`https://github.com/simay-uygur/Grant-Intelligence-Platform.git`](https://github.com/simay-uygur/Grant-Intelligence-Platform.git)

### Notes:
* **Ensure all code is committed and pushed:** All frontend, backend, AI agent, test suites, and deployment workflows are committed and pushed to both `main` (Production) and `develop` (Staging) branches.
* **Confirm the repository includes a README.md with clear setup instructions:** The repository includes a comprehensive [README.md](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/README.md) covering technology stack, prerequisites, quick-start commands, and architecture overview.
* **Mention any dependencies or environment setup if needed:** Detailed prerequisites (Bun 1.x, Node.js 20+, Python 3.11+, AWS CLI) and `.env` setup guides are provided.
* **Code is organized and folders/files are clearly named:** The codebase is modularly structured into `frontend/`, `backend/`, `ai-agent/`, `deploy/`, `tests/`, `docs/`, and `scripts/`.

---

## 3. Submit Working Demo:

**Video Demo Link (Google Drive):**  
`[Insert Google Drive link here — ensure sharing is set to "Anyone with the link can view"]`

### Demo Checklist:
* [x] Screen recording clearly demonstrates all key features (Grant Search, Matchmaking, Section Drafting, Pipeline Kanban, Document Export).
* [x] User interactions and flows are shown end to end.
* [x] Video is clear, stable, and reasonably edited (no unnecessary long pauses).
* [x] Video duration strictly does not exceed 2 minutes.

**Optional: Deployed Website Link (if applicable):**  
[`https://grant-intelligence-develop.m517ty8xjy1cw.us-east-1.cs.amazonlightsail.com/`](https://grant-intelligence-develop.m517ty8xjy1cw.us-east-1.cs.amazonlightsail.com/)  
*(Live staging environment deployed on Amazon Lightsail Container Services with Nginx reverse proxy and live FastAPI health check at `/api/v1/health`)*
