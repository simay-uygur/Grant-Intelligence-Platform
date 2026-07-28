import type { GrantSearchResult, OrganisationProfile } from "@/types";

export interface GrantService {
  searchGrants(profile: OrganisationProfile): Promise<GrantSearchResult>;
}
