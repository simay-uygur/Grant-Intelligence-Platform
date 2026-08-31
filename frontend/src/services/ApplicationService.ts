import type {
  ApplicationDocument,
  Attachment,
  Grant,
  OrganisationProfile,
  OutlineSection,
} from "@/types";
import type { ApplicationStatus, DemoApplication } from "@/data/mockApplications";
import type { SseEvent } from "./apiClient";

export interface OpenedApplication {
  document: ApplicationDocument;
  grant?: Grant;
  profile?: OrganisationProfile;
}

export interface StartApplicationOptions {
  /** Backend chat conversation whose uploaded documents should inform the draft. */
  conversationId?: string;
  /** Custom or user-reviewed sections for drafting. */
  sections?: OutlineSection[];
  customInstructions?: string;
  templateType?: string;
}

export interface UploadDocumentOptions {
  conversationId?: string;
  applicationId?: string;
}

export interface RewriteSectionOptions {
  sectionId?: string;
  baseRevision?: number;
  persist?: boolean;
}

export interface RewriteSectionResult {
  content: string;
  revision?: number;
  baseRevision?: number;
}

export interface DocumentQaResult {
  answer: string;
  sectionId?: string;
  suggestions?: string[];
}

export interface ApplicationService {
  listApplications(): Promise<DemoApplication[]>;
  getApplication(applicationId: string): Promise<OpenedApplication>;
  updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<DemoApplication>;
  upsertApplicationSummary?(application: DemoApplication): Promise<void>;
  deleteApplication?(applicationId: string): Promise<void>;
  saveSection(
    applicationId: string,
    sectionId: string,
    content: string,
    baseRevision?: number,
  ): Promise<ApplicationDocument>;
  findSavedApplication(grantId: string): Promise<ApplicationDocument | undefined>;
  uploadDocument?(file: File, options?: UploadDocumentOptions): Promise<Attachment>;
  generateOutline?(
    grant: Grant,
    profile: OrganisationProfile,
    options?: StartApplicationOptions,
  ): Promise<OutlineSection[]>;
  startApplication(
    grant: Grant,
    profile: OrganisationProfile,
    onProgress?: (event: SseEvent) => void,
    options?: StartApplicationOptions,
  ): Promise<ApplicationDocument>;
  rewriteSection(
    sectionTitle: string,
    currentContent: string,
    profile: OrganisationProfile,
    grant: Grant | undefined,
    documentId?: string,
    onProgress?: (event: SseEvent) => void,
    instruction?: string,
    options?: RewriteSectionOptions,
  ): Promise<RewriteSectionResult>;
  documentQa?(
    documentId: string,
    question: string,
    sectionId?: string,
    document?: ApplicationDocument,
    grant?: Grant,
    profile?: OrganisationProfile,
  ): Promise<DocumentQaResult>;
}
