import type { GrantSearchResult, OrganisationProfile } from "@/types";
import type { SseEvent } from "./apiClient";

export interface GrantService {
  searchGrants(
    profile: OrganisationProfile,
    onProgress?: (event: SseEvent) => void,
    excludedGrantIds?: string[],
  ): Promise<GrantSearchResult>;
}
