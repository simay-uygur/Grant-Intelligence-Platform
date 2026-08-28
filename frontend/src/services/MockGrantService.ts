import { MOCK_GRANTS } from "@/data/mockGrants";
import type { GrantSearchResult, OrganisationProfile } from "@/types";
import type { GrantService } from "./GrantService";
import type { SseEvent } from "./apiClient";
import { isMockScenario } from "./mockScenario";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockGrantService implements GrantService {
  async searchGrants(
    _profile: OrganisationProfile,
    onProgress?: (event: SseEvent) => void,
    excludedGrantIds?: string[],
    _conversationId?: string,
  ): Promise<GrantSearchResult> {
    onProgress?.({
      event: "thinking",
      stage: "keywords",
      message: "Analyzing organization profile and generating search keywords...",
    });
    await wait(200);
    onProgress?.({
      event: "thinking",
      stage: "search",
      message: "Searching live EU Funding & Tenders Portal...",
    });
    await wait(200);

    if (isMockScenario("search-error")) {
      onProgress?.({
        event: "error",
        stage: "search",
        message: "Simulated grant search error",
      });
      throw new Error(
        "Simulated failure (?mock=search-error): the demo grant index didn't respond. No real service was contacted.",
      );
    }
    if (isMockScenario("search-empty")) {
      onProgress?.({
        event: "result",
        stage: "select",
        message: "No matching grants found",
        data: { grants: [] },
      });
      return {
        grants: [],
        sourceSummary: "No demo grants matched this profile.",
      };
    }

    onProgress?.({
      event: "thinking",
      stage: "select",
      message: "Filtering open calls and ranking best matches...",
    });
    await wait(100);

    const excludedSet = new Set(excludedGrantIds ?? []);
    const filteredGrants = MOCK_GRANTS.filter((g) => !excludedSet.has(g.id));

    onProgress?.({
      event: "result",
      stage: "select",
      message: `Selected ${filteredGrants.length} grant recommendations`,
      data: { grants: filteredGrants },
    });

    return {
      grants: filteredGrants,
      sourceSummary: "Demo grants from the local mock catalogue.",
    };
  }
}
