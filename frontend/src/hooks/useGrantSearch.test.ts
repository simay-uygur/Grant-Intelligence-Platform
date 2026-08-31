import { describe, expect, it } from "vitest";
import { applyResearchProgressEvent, createInitialResearchState } from "./useGrantSearch";

describe("grant search progress reducer", () => {
  it("does not regress to discovery when a late search event arrives after ranking starts", () => {
    let state = createInitialResearchState();

    state = applyResearchProgressEvent(state, {
      event: "thinking",
      stage: "search",
      message: "Querying EU Portal and searching the web in parallel...",
    });
    state = applyResearchProgressEvent(state, {
      event: "thinking",
      stage: "select",
      message: "Evaluating and ranking top matches...",
      data: { candidate_count: 34, eu_count: 12, web_count: 22 },
    });
    state = applyResearchProgressEvent(state, {
      event: "progress",
      stage: "search",
      message: "[Web Discovery] Late web result",
      data: { source: "web_search", candidate_count: 35, eu_count: 12, web_count: 23 },
    });

    expect(state.steps.map((step) => step.status)).toEqual(["done", "done", "active"]);
    expect(state.sources?.web_discovery.status).toBe("done");
    expect(state.sources?.web_discovery.candidateCount).toBe(23);
  });
});
