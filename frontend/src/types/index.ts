export type ApplicationStage =
  "welcome" | "collecting_information" | "researching" | "results" | "application";

/**
 * Covers three conceptually distinct things in one flat, stored shape:
 * Organisation (organisationName/organisationType/organisationDescription/
 * country/region), Project (projectTitle/projectDescription/sector), and
 * Funding preferences (fundingAmount/projectStartDate/projectDuration/
 * eligibilityConstraints). Kept flat rather than split into three nested
 * types to preserve the existing OrganisationForm fields, the stored
 * Conversation.profile shape, and localStorage compatibility. A future
 * backend may model these as separate resources (e.g. Organisation and
 * Project as distinct records) — see docs/api-contract.md.
 */
export interface OrganisationProfile {
  // Organisation
  organisationName: string;
  organisationType: string;
  organisationDescription: string;
  country: string;
  region: string;
  // Project
  projectTitle: string;
  projectDescription: string;
  sector: string;
  // Funding preferences
  fundingAmount: string;
  projectStartDate: string;
  projectDuration: string;
  eligibilityConstraints: string;
}

export type GrantProvenance = "mock" | "live";

/**
 * Frontend grant model. Live sources only guarantee identity, source, title,
 * and description; richer recommendation and eligibility fields are optional
 * because the backend must not invent values its upstream source did not send.
 *
 * `provenance` is optional for backwards compatibility with conversations
 * already stored in localStorage before live API integration was introduced.
 */
export interface Grant {
  id: string;
  /** Present on newly fetched grants; optional for legacy locally stored grants. */
  source?: string;
  title: string;
  description: string;
  provenance?: GrantProvenance;
  programme?: string;
  matchPercentage?: number;
  fundingAmount?: string;
  deadline?: string;
  eligibleCountries?: string[];
  organisationEligibility?: string[];
  fundingType?: string;
  whyItMatches?: string;
  matchReasons?: string[];
  requirements?: string[];
  tags?: string[];
  sourceUrl?: string;
}

export interface GrantSearchResult {
  grants: Grant[];
  sourceSummary: string;
}

/** One section of an Application (see ApplicationDocument). */
export interface DocumentSection {
  id: string;
  title: string;
  content: string;
}

/** An in-progress grant Application draft. */
export interface ApplicationDocument {
  id: string;
  grantId: string;
  grantTitle: string;
  sections: DocumentSection[];
  updatedAt: string;
}

export interface ResearchStep {
  label: string;
  status: "pending" | "active" | "done";
  detail?: string;
}

/** Progress of the current research session (grant matching in progress for a profile). */
export interface ResearchState {
  steps: ResearchStep[];
  error?: string;
}

/**
 * A file the user has selected in the composer. Not currently uploaded
 * anywhere — selection is local-only (see Composer.tsx) and no Attachment
 * value is constructed or stored yet. Modelled here ahead of time so a
 * future upload integration has a clear target shape to produce and a
 * ChatBlock variant to render it as, without needing to invent one under
 * time pressure later. See docs/api-contract.md ("File upload").
 */
export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: "uploading" | "uploaded" | "failed";
}

export interface DraftProgressState {
  grantTitle: string;
  currentSectionTitle?: string;
  thought?: string;
  wordCount?: number;
  liveTextChunk?: string;
  sectionIndex?: number;
  totalSections?: number;
  percent: number;
  error?: string;
}

export type ChatBlock =
  | { type: "text"; text: string }
  | { type: "question"; text: string }
  | { type: "structured_form"; profile?: Partial<OrganisationProfile> }
  | { type: "research_status"; state: ResearchState }
  | { type: "draft_progress"; state: DraftProgressState }
  | { type: "grant_results"; grants: Grant[]; sourceSummary?: string }
  | { type: "document"; documentId: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export interface ChatMessage {
  id: string;
  /** Persisted backend message identifier, assigned when chat history is synchronized. */
  backendMessageId?: number;
  role: "user" | "assistant";
  createdAt: string;
  blocks: ChatBlock[];
}

export interface Conversation {
  id: string;
  /** Backend chat identifier; absent for mock mode and legacy local conversations. */
  backendConversationId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  stage: ApplicationStage;
  profile?: OrganisationProfile;
  grants?: Grant[];
  selectedGrantId?: string;
  document?: ApplicationDocument;
}
