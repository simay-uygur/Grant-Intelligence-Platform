import type {
  ApplicationDocument,
  Grant,
  OrganisationProfile,
} from "@/types";

export interface GrantIntelligenceService {
  searchGrants(profile: OrganisationProfile): Promise<Grant[]>;
  startApplication(
    grant: Grant,
    profile: OrganisationProfile,
  ): Promise<ApplicationDocument>;
  rewriteSection(
    sectionTitle: string,
    currentContent: string,
    profile: OrganisationProfile,
    grant: Grant | undefined,
    /** Free-text instruction from the user (e.g. "make it more concise"). Optional so existing callers that just want a generic rewrite keep working unchanged. */
    instruction?: string,
  ): Promise<string>;
}
