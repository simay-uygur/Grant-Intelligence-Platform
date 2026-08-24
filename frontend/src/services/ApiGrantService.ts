import type { Grant, GrantSearchResult, OrganisationProfile, SavedGrant } from "@/types";
import type { GrantService } from "./GrantService";
import { ApiClient, type SseEvent } from "./apiClient";
import { buildGrantSearchRequest, mapGrantResult, parseGrantSearchResponse } from "./grantApi";

const GRANT_SEARCH_STREAM_PATH = "/api/v1/grants/search/stream";

export class ApiGrantService implements GrantService {
  private readonly client: ApiClient;

  constructor(baseUrl?: string, client?: ApiClient) {
    this.client = client ?? new ApiClient(baseUrl);
  }

  async searchGrants(
    profile: OrganisationProfile,
    onProgress?: (event: SseEvent) => void,
  ): Promise<GrantSearchResult> {
    const request = buildGrantSearchRequest(profile);
    const payload = await this.client.requestSse<unknown>(
      GRANT_SEARCH_STREAM_PATH,
      {
        method: "POST",
        body: JSON.stringify(request),
      },
      onProgress,
    );
    const response = parseGrantSearchResponse(payload);
    return {
      grants: response.grants.map(mapGrantResult),
      sourceSummary: response.source_summary,
    };
  }

  async listSavedGrants(): Promise<SavedGrant[]> {
    const data = await this.client.request<{ savedGrants: SavedGrant[] }>("/api/v1/grants/saved");
    return data.savedGrants ?? [];
  }

  async saveGrant(grant: Grant | SavedGrant): Promise<SavedGrant> {
    return await this.client.request<SavedGrant>("/api/v1/grants/saved", {
      method: "POST",
      body: JSON.stringify(grant),
    });
  }

  async deleteSavedGrant(grantId: string): Promise<void> {
    await this.client.request<void>(`/api/v1/grants/saved/${encodeURIComponent(grantId)}`, {
      method: "DELETE",
    });
  }
}
