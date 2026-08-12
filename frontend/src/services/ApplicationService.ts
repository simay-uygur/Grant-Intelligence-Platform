import type { ApplicationDocument, Grant, OrganisationProfile } from "@/types";
import type { ApplicationStatus, DemoApplication } from "@/data/mockApplications";

export interface ApplicationService {
  listApplications(): Promise<DemoApplication[]>;
  updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<DemoApplication>;
  saveSection(applicationId: string, sectionId: string, content: string): Promise<void>;
  findSavedApplication(grantId: string): Promise<ApplicationDocument | undefined>;
  startApplication(grant: Grant, profile: OrganisationProfile): Promise<ApplicationDocument>;
  rewriteSection(
    sectionTitle: string,
    currentContent: string,
    profile: OrganisationProfile,
    grant: Grant | undefined,
    documentId?: string,
  ): Promise<string>;
}
