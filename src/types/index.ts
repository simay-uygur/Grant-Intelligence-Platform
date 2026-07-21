export type ApplicationStage =
  | "welcome"
  | "collecting_information"
  | "researching"
  | "results"
  | "application";

export interface OrganisationProfile {
  organisationName: string;
  organisationType: string;
  organisationDescription: string;
  country: string;
  region: string;
  projectTitle: string;
  projectDescription: string;
  fundingAmount: string;
  projectStartDate: string;
  projectDuration: string;
  sector: string;
  eligibilityConstraints: string;
}

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

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
}

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

export interface ResearchState {
  steps: ResearchStep[];
  error?: string;
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
