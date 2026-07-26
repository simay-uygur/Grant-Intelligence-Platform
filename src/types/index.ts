export type ApplicationStage =
  | "welcome"
  | "collecting_information"
  | "researching"
  | "results"
  | "application";

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

/**
 * A matched grant, already carrying its own recommendation fields
 * (matchPercentage/whyItMatches/matchReasons) rather than a separate
 * "GrantRecommendation" wrapper — a search always returns grants in the
 * context of a profile, so the match is intrinsic to the result, not a
 * separate relationship to model.
 */
export interface Grant {
  id: string;
  programme: string;
  title: string;
  matchPercentage: number;
  fundingAmount: string;
  deadline: string;
  eligibleCountries: string[];
  organisationEligibility: string[];
  fundingType: string;
  description: string;
  whyItMatches: string;
  matchReasons: string[];
  requirements: string[];
  tags: string[];
  sourceUrl: string;
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

export type ChatBlock =
  | { type: "text"; text: string }
  | { type: "question"; text: string }
  | { type: "structured_form"; profile?: Partial<OrganisationProfile> }
  | { type: "research_status"; state: ResearchState }
  | { type: "grant_results"; grants: Grant[] }
  | { type: "document"; documentId: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  createdAt: string;
  blocks: ChatBlock[];
}

export interface Conversation {
  id: string;
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
