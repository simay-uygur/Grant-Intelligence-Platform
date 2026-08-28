import type { ApplicationDocument, Grant, OrganisationProfile } from "@/types";
import type { GrantIntelligenceService } from "./GrantIntelligenceService";
import { ApiClient } from "./apiClient";

/**
 * Stub for the future FastAPI backend. None of these endpoints exist yet —
 * see docs/api-contract.md for the fuller proposed shapes. Each method below
 * is a TODO(api) integration point: the request/response shapes here are a
 * reasonable starting guess, not a finalised contract with the backend team.
 *
 *   POST   /grants/search                          — TODO(api): confirm request/response shape with backend team
 *   POST   /grants/{grantId}/start-application      — TODO(api): confirm request/response shape with backend team
 *   PATCH  /documents/{documentId}/sections/{id}    — not yet called from the frontend (see useConversations)
 *   POST   /documents/{documentId}/sections/{id}/rewrite — TODO(api): rewrite endpoint not implemented yet
 */
export class ApiGrantIntelligenceService implements GrantIntelligenceService {
  private readonly client: ApiClient;

  constructor(baseUrl?: string) {
    this.client = new ApiClient(baseUrl);
  }

  // TODO(api): backend team to confirm the exact request/response contract.
  async searchGrants(profile: OrganisationProfile): Promise<Grant[]> {
    return this.client.request<Grant[]>("/grants/search", {
      method: "POST",
      body: JSON.stringify({ profile }),
    });
  }

  // TODO(api): backend team to confirm the exact request/response contract.
  async startApplication(grant: Grant, profile: OrganisationProfile): Promise<ApplicationDocument> {
    return this.client.request<ApplicationDocument>(`/grants/${grant.id}/start-application`, {
      method: "POST",
      body: JSON.stringify({ profile }),
    });
  }

  // TODO(api): no rewrite endpoint exists yet — this mirrors the interface
  // so switching VITE_API_MODE=api doesn't silently drop the feature; it
  // fails loudly instead of pretending to work. The interface's optional
  // `instruction` param (see GrantIntelligenceService) would pass straight
  // through in the request body once this calls a real endpoint — no params
  // are declared here since none are used while this only throws.
  async rewriteSection(): Promise<string> {
    throw new Error("Rewrite is not yet available on the API backend");
  }
}
