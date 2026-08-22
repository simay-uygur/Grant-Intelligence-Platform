# Grant Intelligence Platform — Final Project Report

**AWS Amazon University Engagement Program (UEP)**  
**Submission Window:** Week 10 (August 24 – August 31)

---

## 1. Executive Summary & Team Information

### Team Members
* **Dea Berisha**
* **Bleron Bajraktari**
* **Simay Uygur**

### Project Overview
The **Grant Intelligence Platform** is an AI-powered cloud platform designed to automate grant discovery, preference-based grant matchmaking, and interactive application drafting. Built as part of the AWS Amazon University Engagement Program (UEP), the platform bridges non-repayable public/private grant funding with SMEs, researchers, and startups by translating complex Standard Operating Procedures (SOPs) into automated tool-use loops driven by **Amazon Bedrock**.

---

## 2. System Architecture & Technology Stack

```text
[ Browser / Client UI ] (React 19 + TypeScript + Vite / Bun)
         │
         │ HTTP / SSE Stream
         ▼
[ NGINX Reverse Proxy ] (Port 80 / Public HTTPS)
         ├── /       ──> [ Frontend Container ] (Port 3000)
         └── /api/*  ──> [ FastAPI Backend Container ] (Port 8000)
                               │
                               ├──> [ SQLite / AWS Managed DB ] (User Auth, History, Drafts)
                               └──> [ Amazon Bedrock Loop ] (Claude 3.5 Sonnet / Tool Calling)
                                         └──> EU Horizon & External Grant Search APIs
```

### Technology Stack Summary
* **Frontend**: React 19, TypeScript, Vite, Bun runtime, Tailwind CSS v4, Radix UI / shadcn components.
* **Backend**: Python 3.11+, FastAPI, Pydantic v2, Uvicorn, HTTPX, Pytest.
* **AI & Cloud Layer**: Amazon Bedrock (`boto3`), Anthropic Claude 3.5 Sonnet, Model Context Protocol (MCP) in-process tool loops.
* **DevOps & Containerization**: Docker, Docker Compose, AWS Lightsail Container Services, GitHub Actions CI/CD.

---

## 3. Development Process & Project Milestones

The project was executed iteratively over a 10-week lifecycle:

1. **Phase 1: Foundation & Baseline (Weeks 1–3)**:
   - Established repository structure, FastAPI endpoints, baseline schemas, and mock data sources.
   - Configured initial local development commands and frontend UI shell.
2. **Phase 2: Data Integrations & Bedrock Loop (Weeks 4–6)**:
   - Replaced mock grant data with real external API data sources (EU Horizon & Portal integrations).
   - Designed tool execution handlers enabling Bedrock to invoke search tools autonomously.
3. **Phase 3: Multi-Container Architecture & Cloud Deployment (Weeks 7–8)**:
   - Containerized application into multi-service stack (`nginx`, `frontend`, `backend`).
   - Built GitHub Actions CI/CD workflows targeting AWS Lightsail (`grant-intelligence-main` & `grant-intelligence-develop`).
4. **Phase 4: Session Storage, Telemetry & Polishing (Weeks 9–10)**:
   - Implemented environment toggles (`VITE_API_MODE`, `SESSION_STORAGE_TYPE`) and `scripts/set_env_mode.sh`.
   - Enhanced real-time SSE progress streaming and document generation workflows.

---

## 4. Key Challenges Encountered & Solutions Implemented

### Challenge 1: Container Data Ephemerality & Session Persistence
* **Problem**: In AWS Lightsail Container Services, containers are stateless. Redeploying code deleted the container-local SQLite database (`storage/backend.db`), wiping user accounts, chat history, and application drafts.
* **Solution Implemented**:
  1. Built a configurable `SESSION_STORAGE_TYPE` flag (`local` vs `hosted`) supporting both local SQLite and remote databases.
  2. Documented AWS Lightsail Attached Disk / EBS volume mounting (`/app/storage`) and Litestream + S3 real-time replication to guarantee database survival without code changes.

### Challenge 2: Managing Multiple Development & Testing Permutations
* **Problem**: Developers needed to switch between offline mock testing, local backend debugging, and full cloud API integration testing.
* **Solution Implemented**:
  - Created a unified management script [`scripts/set_env_mode.sh`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/scripts/set_env_mode.sh) supporting all 4 environment permutations (`--both-local`, `--both-deployed`, `--fe-local-db-deployed`, `--fe-deployed-db-local`).

### Challenge 3: Real-Time AI Execution Feedback & Progress Transparency
* **Problem**: AI tool execution and grant drafting can take several seconds, leaving users with uninformative loading spinners.
* **Solution Implemented**:
  - Implemented Server-Sent Events (SSE) streaming progress notifications, emitting granular stage updates (*"Analyzing criteria..."*, *"Executing search tool..."*, *"Drafting section..."*).

---

## 5. Verification & Testing Strategy

The platform was verified through a multi-tiered quality assurance strategy:

* **Backend Unit & Integration Tests**: Executed via Pytest (`pytest tests -q`) covering health checks, auth TTL tokens, metadata endpoints, and conversation stores.
* **Frontend Unit & Component Tests**: Executed via Bun (`bun run test`) testing adapter transformations, local storage fallbacks, and conversation history merging.
* **End-to-End Browser Testing**: Executed via Playwright (`bun run test:e2e`) verifying grant search, navigation flows, and deployment endpoints.
* **Interactive API Verification**: Validated via FastAPI OpenAPI / Swagger documentation (`http://localhost:8000/docs`).

---

## 6. Codebase Documentation Checklist

- [x] Comprehensive [README.md](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/README.md) with architecture, prerequisites, and quick-start commands.
- [x] Complete [DEPLOYMENT_NOTES.md](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/DEPLOYMENT_NOTES.md) detailing Lightsail container setup, secrets, and database persistence options.
- [x] Separately copyable command reference in [commands.md](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/commands.md).
- [x] Active task roadmap and feature checklist in [todo.md](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/todo.md).
- [x] Documented environment toggle script at [`scripts/set_env_mode.sh`](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/scripts/set_env_mode.sh).
