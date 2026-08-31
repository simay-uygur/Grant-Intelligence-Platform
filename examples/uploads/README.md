# Sample Documents to Upload

Use these files to demonstrate how chat document upload gives the assistant real applicant context.

Supported upload formats are: `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, and `.json`.

| File | Format | Demonstrates |
|---|---:|---|
| `annual-report-2025.pdf` | PDF | Financial and operational background for credibility checks. |
| `capability-statement.docx` | DOCX | Prior experience, team strengths, and delivery capability. |
| `company-profile.txt` | TXT | Plain-text organisation background. |
| `project-summary.md` | MD | Project goals, work plan, and expected impact. |
| `budget-breakdown.csv` | CSV | Structured budget categories and cost assumptions. |
| `team-and-partners.json` | JSON | Structured team, partner, and eligibility evidence. |

Suggested demo flow:

1. Start the backend and frontend in API mode.
2. Open a normal chat conversation.
3. Upload one or more files from this folder with the paperclip button.
4. Ask a question such as `What facts from my uploaded documents should I emphasize?`
5. Generate an application draft; the uploaded text is included as context for outline generation, drafting, and document Q&A.
