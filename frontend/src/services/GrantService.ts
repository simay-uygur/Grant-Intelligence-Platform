import type { GrantSearchBatch, GrantSearchResult, OrganisationProfile } from "@/types";
import type { SseEvent } from "./apiClient";

export interface GrantService {
  searchGrants(
    profile: OrganisationProfile,
    onProgress?: (event: SseEvent) => void,
    excludedGrantIds?: string[],
    conversationId?: string,
  ): Promise<GrantSearchResult>;

  listSearchBatches?(conversationId?: string): Promise<GrantSearchBatch[]>;
  getSearchBatch?(batchId: string): Promise<GrantSearchBatch>;
}
