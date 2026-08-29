# Grant Application Drafting Logic & Horizon Europe Frameworks

This document details the architecture, logic, and user flow of the **Grant Application Drafting Engine**, specifically explaining how different European funding structures (such as **Horizon Europe Pillar 2 Collaborative Grants** vs. **Horizon Europe Pillar 3 EIC Accelerator**) are analyzed, outlined, streamed, and customized.

---

## 1. Horizon Europe Architecture & Pillar Distinction

**Horizon Europe** (€95.5B, 2021–2027) is organized into three distinct pillars with differing objectives, applicant requirements, and evaluation rubrics:

```
                          Horizon Europe Framework (€95.5B)
                 ┌────────────────────────┼────────────────────────┐
              Pillar 1                 Pillar 2                 Pillar 3
         Excellent Science       Global Challenges &        Innovative Europe
        • ERC Research Grants    Industrial Competitiveness • EIC Accelerator (Startups)
        • Marie Skłodowska-Curie • RIA / IA Collaborative   • EIC Pathfinder
                                   Consortium Topics        • EIT Knowledge Communities
```

### Pillar Comparison Table

| Feature | Pillar 2: Collaborative R&I (RIA / IA) | Pillar 3: EIC Accelerator |
| :--- | :--- | :--- |
| **Target Applicant** | Multi-partner **Consortium** (≥ 3 independent entities from 3 different EU/Associated countries) | **Single for-profit SME or Deep-Tech Startup** |
| **Funding Structure** | 100% (RIA) or 70% (IA) non-dilutive grant (€2M – €10M+) | Blended Finance: up to **€2.5M grant** + up to **€15M equity investment** |
| **Target Technology Level** | Low to Mid TRL (TRL 3 → 6) | High TRL scale-up (TRL 5/6 → 8/9) |
| **Core Proposal Focus** | Scientific excellence, multi-partner work packages, European policy impact | Commercial scalability (TAM/SAM/SOM), defensibility/IP, team track record, private investor de-risking |

---

## 2. Adaptive Outline Generation Workflow

When a user initiates an application draft, the backend does not rely on a static template. Instead, [generate_outline.py](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/ai-agent/tools/generate_outline.py) inspects the selected call's metadata and objectives to dynamically construct the proposal outline.

```
Grant Selected (User clicks "Start Application")
       │
       ▼
`POST /api/v1/grants/{id}/outline`
       │
       ├──► 1. Programme Detection (e.g. "horizon" + "ria", "eic", "accelerator")
       │
       ├──► 2. Call Text Analysis (AWS Bedrock extracts 4–6 specific proposal sections)
       │
       ▼
Outline Preview Modal Pops Up (Frontend)
       ├── Reorder via Drag & Drop (⋮⋮) or Jump to Top/Bottom (⇈ / ⇊)
       ├── Add Custom Sections (with 1-click "Add at Top" or "Add at End")
       └── Edit section titles and guidance notes
       │
       ▼
User Confirms Outline ──► Triggers `start_application_stream`
```

### Outline Section Templates

#### A. Horizon Europe RIA / IA Standard Outline
1. **Excellence & Beyond State-of-the-Art** (~180 words): Scientific and technological methodology, objectives clarity, ambition beyond state-of-the-art.
2. **Expected Impact & Pathways** (~180 words): Scale and significance of expected outcomes, dissemination, exploitation, and policy contribution.
3. **Quality & Efficiency of Implementation** (~180 words): Work packages, partner complementarity, risk mitigation strategy, and milestone timeline.
4. **Budget Overview & Resource Allocation** (~120 words): Justification of EU contribution, person-months distribution, and direct costs.

#### B. EIC Accelerator Deep-Tech Pitch Outline
1. **Breakthrough Innovation & Technology Readiness** (~180 words): Deep-tech novelty, current TRL level, patent/IP position, and technical defensibility.
2. **Market Opportunity & Commercialisation** (~180 words): Total Addressable Market (TAM/SAM/SOM), customer traction, pricing model, and pan-European scale-up roadmap.
3. **Company & Team Track Record** (~150 words): Founders' background, technical competencies, ownership structure, and advisory board.
4. **Financing Needs & Risk Mitigation** (~150 words): Milestones for grant and equity blended finance, co-investment readiness, and de-risking plan.

#### C. Adaptive Bedrock Outline (General Calls & Extracted Call Text)
For niche or live calls with extracted call text, AWS Bedrock prioritizes the call objectives, scope, and topics alongside the applicant profile to return between 4 and 8 tailored section slugs, descriptions, and recommended word count targets.

---

## 3. Format & Content Tailoring for Web-Discovered Grants

When users initiate application drafting on grants discovered through **Web Search** ([web_search.py](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/ai-agent/tools/web_search.py)), the platform dynamically tailors both proposal format and drafting content to match non-SEDIA funding agencies:

### A. Format Tailoring (Adaptive Proposal Outlines)
[generate_outline.py](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/ai-agent/tools/generate_outline.py) inspects the specific grant title, programme, and web summary snippet:

1. **For Eureka / Eurostars Calls**:
   Bedrock constructs an outline matching Eurostars' SME commercialization rules:
   - **Market-Driven Innovation & Cross-Border Collaboration**: Transnational synergy, market readiness, and partner roles.
   - **SME Lead & R&D Capability**: Leadership role of the innovative SME, technical core competencies.
   - **Work Plan & Fast Time-to-Market (24 months)**: Concrete milestones and commercial release roadmap within 2 years of project completion.
   - **Commercial Exploitation & ROI**: Sales projections, European market penetration, and return on investment.

2. **For National Innovation Calls (e.g., Innovate UK, German BMBF, Nordic Innovation)**:
   Adapts to national innovation agency priorities:
   - **Need for Public Funding & Additionality**: Why public support is necessary and how it de-risks the initiative.
   - **Market Opportunity & Domestic/Export Growth**: Commercial demand, job creation, and export expansion.
   - **Technical Feasibility & Project Delivery**: Milestones, testing methodology, and team execution.
   - **Risk Management & Financial Breakdown**: Project governance, financial controls, and risk mitigation.

3. **For General Thematic Web Grants**:
   Generates 4 to 8 sections mapped directly to the specific technical topics extracted in the web search snippet.

### B. Content Prose Tailoring
When drafting the proposal prose in [start_application.py](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/ai-agent/tools/start_application.py):
- **Context Injection**: Every section prompt injects the grant's title, funder, and extracted call summary/scope alongside the applicant's company profile.
- **Explicit Strategic Alignment**: Prompts instruct the LLM to explicitly connect the applicant's real technology and pilot metrics to the funding agency's stated goals, producing high-impact, funder-tailored proposals.

---

## 3. Real-Time Token Streaming & Progress Engine

Drafting full proposals is handled via server-sent events (SSE) in [service.py](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/ai-agent/agent/service.py#L207-L376) and [DraftProgressCard.tsx](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/frontend/src/components/widgets/DraftProgressCard.tsx).

### Stream Event Flow

```
1. `event: thinking`
   └─ Message: "Analyzing Grant Requirements & Priorities for '[Grant Title]' (N sections)..."
   └─ Thought: "Extracting call objectives and aligning [Org Name] capabilities..."

2. `event: thinking` (Per-section)
   └─ Message: "Formulating Section X/N: [Section Title]..."

3. `event: section_chunk` (Repeated token-by-token)
   └─ Emits delta text chunks from AWS Bedrock `converse_stream`.
   └─ Frontend displays a live typing card with real-time word counter.

4. `event: progress`
   └─ Message: "Completed Section X/N: [Section Title] (Y% complete)"
   └─ Updates overall progress bar and steps indicator.

5. `event: result`
   └─ Document compilation complete; stores the application and renders the Application Document View.
```

---

## 4. How to See and Filter Pillars in the App

Users can observe and interact with specific pillars in multiple areas of the platform:

1. **Natural Language Steering in Chat**:
   - Query: *"Find EIC Accelerator grants for our AI SME"* → Agent filters specifically for single-SME deep-tech venture calls.
   - Query: *"Search Horizon Europe Pillar 2 manufacturing and robotics consortia"* → Agent queries collaborative RIA/IA topics.

2. **Grant Result Cards**:
   - Every grant card displays a programme pill badge (e.g. `Horizon Europe`, `EIC Accelerator`, `Digital Europe`) alongside funding amount, deadline, and eligibility indicators.
   - Clicking **"↗ View Official Call on Portal"** opens the European Commission's exact funding topic details.

3. **Outline Preview Modal Subtitle**:
   - When clicking **"Start application"**, the modal header displays the detected programme and links directly to the official call text.

4. **Pipeline Kanban Board**:
   - The **Pipeline Dashboard** displays all drafted applications categorized by lifecycle status (*Drafting, Submitted, Under Review, Approved, Rejected*) and lists the funder programme for each entry.

---

## 5. Post-Drafting Tools & Export Capabilities

Once drafted, each proposal document supports:

- **Clean Dynamic Numbering**: Section titles are cleanly numbered based on their current order without hardcoded duplication.
- **Section-Level AI Rewriting**: Click "Rewrite with AI" to trigger [rewrite_section_stream](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/ai-agent/agent/service.py#L393) with targeted custom instructions.
- **Document Q&A**: Live assistant consultation on the proposal text via [document_qa_stream](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/ai-agent/agent/service.py#L472).
- **Full Document Workspace**: Click "Open full workspace" for multi-section view, batch revision, and side-by-side editing.
- **PDF & Word (.docx) Export**: Download publication-ready documents formatted with grant metadata, official call links, and page numbers via [export.ts](file:///Users/simayy/Documents/aws_uep_github/Grant-Intelligence-Platform/frontend/src/utils/export.ts).
