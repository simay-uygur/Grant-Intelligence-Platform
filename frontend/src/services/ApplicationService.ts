import type { ApplicationDocument, Grant, OrganisationProfile } from "@/types";

export interface ApplicationService {
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
