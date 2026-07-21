import { ApiGrantIntelligenceService } from "./ApiGrantIntelligenceService";
import type { GrantIntelligenceService } from "./GrantIntelligenceService";
import { MockGrantIntelligenceService } from "./MockGrantIntelligenceService";

const mode = (import.meta.env.VITE_API_MODE as string | undefined) ?? "mock";

export const grantService: GrantIntelligenceService =
  mode === "api"
    ? new ApiGrantIntelligenceService()
    : new MockGrantIntelligenceService();

export const isMockMode = mode !== "api";
export type { GrantIntelligenceService };
