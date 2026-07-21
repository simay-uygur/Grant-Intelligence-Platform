import type {
  ApplicationDocument,
  Grant,
  OrganisationProfile,
} from "@/types";
import type { GrantIntelligenceService } from "./GrantIntelligenceService";

/**
 * Stub for the future FastAPI backend. Endpoints (not yet implemented):
 *   POST   /api/conversations
 *   POST   /api/conversations/{conversationId}/messages
 *   POST   /api/grants/search
 *   POST   /api/grants/{grantId}/start-application
 *   PATCH  /api/documents/{documentId}/sections/{sectionId}
 *   GET    /api/documents/{documentId}/export
 */
export class ApiGrantIntelligenceService implements GrantIntelligenceService {
  constructor(private readonly baseUrl: string = "/api") {}

  async searchGrants(profile: OrganisationProfile): Promise<Grant[]> {
    const res = await fetch(`${this.baseUrl}/grants/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    if (!res.ok) throw new Error(`Grant search failed (${res.status})`);
    return (await res.json()) as Grant[];
  }

  async startApplication(
    grant: Grant,
    profile: OrganisationProfile,
  ): Promise<ApplicationDocument> {
    const res = await fetch(
      `${this.baseUrl}/grants/${grant.id}/start-application`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      },
    );
    if (!res.ok) throw new Error(`Start application failed (${res.status})`);
    return (await res.json()) as ApplicationDocument;
  }

  async rewriteSection(): Promise<string> {
    throw new Error("Rewrite is not yet available on the API backend");
  }
}
