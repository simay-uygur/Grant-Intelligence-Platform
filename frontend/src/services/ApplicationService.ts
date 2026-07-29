import type { ApplicationDocument, Grant, OrganisationProfile } from "@/types";

export interface ApplicationService {
  startApplication(grant: Grant, profile: OrganisationProfile): Promise<ApplicationDocument>;
  rewriteSection(
    sectionTitle: string,
    currentContent: string,
    profile: OrganisationProfile,
    grant: Grant | undefined,
  ): Promise<string>;
}
