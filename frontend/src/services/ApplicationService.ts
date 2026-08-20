import type { ApplicationDocument, Grant, OrganisationProfile } from "@/types";
import type { ApplicationStatus, DemoApplication } from "@/data/mockApplications";
import type { SseEvent } from "./apiClient";

export interface OpenedApplication {
  document: ApplicationDocument;
  grant?: Grant;
  profile?: OrganisationProfile;
}

export interface ApplicationService {
  listApplications(): Promise<DemoApplication[]>;
  getApplication(applicationId: string): Promise<OpenedApplication>;
  updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<DemoApplication>;
  upsertApplicationSummary?(application: DemoApplication): Promise<void>;
  saveSection(applicationId: string, sectionId: string, content: string): Promise<void>;
  findSavedApplication(grantId: string): Promise<ApplicationDocument | undefined>;
  startApplication(
    grant: Grant,
    profile: OrganisationProfile,
    onProgress?: (event: SseEvent) => void,
  ): Promise<ApplicationDocument>;
  rewriteSection(
    sectionTitle: string,
    currentContent: string,
    profile: OrganisationProfile,
    grant: Grant | undefined,
    documentId?: string,
    onProgress?: (event: SseEvent) => void,
  ): Promise<string>;
}

