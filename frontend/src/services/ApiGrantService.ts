import type {
  Grant,
  GrantSearchBatch,
  GrantSearchResult,
  OrganisationProfile,
  SavedGrant,
} from "@/types";
import type { GrantService } from "./GrantService";
import { ApiClient, type SseEvent } from "./apiClient";
import {
  buildGrantSearchRequest,
  mapGrantResult,
  mapGrantSearchBatch,
  parseGrantSearchBatchesResponse,
  parseGrantSearchResponse,
} from "./grantApi";

const GRANT_SEARCH_STREAM_PATH = "/api/v1/grants/search/stream";

export class ApiGrantService implements GrantService {
  private readonly client: ApiClient;

  constructor(baseUrl?: string, client?: ApiClient) {
    this.client = client ?? new ApiClient(baseUrl);
  }

  async searchGrants(
    profile: OrganisationProfile,
    onProgress?: (event: SseEvent) => void,
    excludedGrantIds?: string[],
    conversationId?: string,
  ): Promise<GrantSearchResult> {
    const request = buildGrantSearchRequest(profile, excludedGrantIds, conversationId);
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
      batchId: response.batch_id ?? undefined,
      batchIndex: response.batch_index ?? undefined,
    };
  }

  async listSearchBatches(conversationId?: string): Promise<GrantSearchBatch[]> {
    const query = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : "";
    const payload = await this.client.request<unknown>(`/api/v1/grants/batches${query}`);
    const response = parseGrantSearchBatchesResponse(payload);
    return response.batches.map(mapGrantSearchBatch);
  }

  async getSearchBatch(batchId: string): Promise<GrantSearchBatch> {
    const payload = await this.client.request<unknown>(
      `/api/v1/grants/batches/${encodeURIComponent(batchId)}`,
    );
    const parsed = parseGrantSearchBatchesResponse({ batches: [payload] });
    return mapGrantSearchBatch(parsed.batches[0]);
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
