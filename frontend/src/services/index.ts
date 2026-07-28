import { ApiGrantIntelligenceService } from "./ApiGrantIntelligenceService";
import type { GrantIntelligenceService } from "./GrantIntelligenceService";
import { MockGrantIntelligenceService } from "./MockGrantIntelligenceService";

const mode = (import.meta.env.VITE_API_MODE as string | undefined) ?? "mock";
// Only read/used when mode === "api" — mock mode never touches this and
// never makes a network request.
const apiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;

export const grantService: GrantIntelligenceService =
  mode === "api" ? new ApiGrantIntelligenceService(apiBaseUrl) : new MockGrantIntelligenceService();

export const isMockMode = mode !== "api";
export type { GrantIntelligenceService };
