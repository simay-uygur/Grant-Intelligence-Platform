import { MOCK_GRANTS } from "@/data/mockGrants";
import type { GrantSearchResult, OrganisationProfile } from "@/types";
import type { GrantService } from "./GrantService";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockGrantService implements GrantService {
  async searchGrants(_profile: OrganisationProfile): Promise<GrantSearchResult> {
    await wait(400);
    return {
      grants: MOCK_GRANTS,
      sourceSummary: "Demo grants from the local mock catalogue.",
    };
  }
}
