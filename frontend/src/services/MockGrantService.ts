import { MOCK_GRANTS } from "@/data/mockGrants";
import type { GrantSearchResult, OrganisationProfile } from "@/types";
import type { GrantService } from "./GrantService";
import { isMockScenario } from "./mockScenario";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockGrantService implements GrantService {
  async searchGrants(_profile: OrganisationProfile): Promise<GrantSearchResult> {
    await wait(400);
    if (isMockScenario("search-error")) {
      throw new Error(
        "Simulated failure (?mock=search-error): the demo grant index didn't respond. No real service was contacted.",
      );
    }
    if (isMockScenario("search-empty")) {
      return {
        grants: [],
        sourceSummary: "No demo grants matched this profile.",
      };
    }
    return {
      grants: MOCK_GRANTS,
      sourceSummary: "Demo grants from the local mock catalogue.",
    };
  }
}
