import { useCallback, useRef, useState } from "react";
import { grantService, isMockMode } from "@/services";
import type { SseEvent } from "@/services/apiClient";
import type { ChatBlock, Grant, OrganisationProfile, ResearchState } from "@/types";

/** Steps shown while streaming live results from the backend agent. */
const LIVE_RESEARCH_STEPS = [
  "Generating search keywords",
  "Searching EU Horizon API opportunities",
  "Filtering & ranking best matches",
];

/** Steps shown in mock / local mode. */
const MOCK_RESEARCH_STEPS = [
  "Understanding organisation profile",
  "Analysing funding requirements",
  "Checking geographical eligibility",
  "Searching European grant programmes",
  "Comparing funding amounts",
  "Reviewing deadlines",
  "Ranking the strongest matches",
];

interface UseGrantSearchOptions {
  /** Called when a research run starts — used to post the research_status block. */
  onResearchStart: (initialState: ResearchState) => string;
  /** Called with a messageId + updater to update the live research_status block. */
  onResearchProgress: (messageId: string, updater: (blocks: ChatBlock[]) => ChatBlock[]) => void;
  /** Called with the final grants + sourceSummary when the search completes. */
  onResearchComplete: (
    grants: Grant[],
    sourceSummary: string | undefined,
    profile: OrganisationProfile,
  ) => void;
  /** Called with an error message if the search fails. */
  onResearchError: (messageId: string, error: string) => void;
  /** Outer busy setter — shared with the rest of App so the composer locks. */
  setBusy: (busy: boolean) => void;
  /** Conversation-level setters. */
  setStage: (stage: "researching" | "results") => void;
  setGrants: (grants: Grant[]) => void;
}

/**
 * useGrantSearch
 *
 * Encapsulates the full grant-search lifecycle:
 *   runResearch        — triggers a live/mock search, streams progress events
 *   handleSubmitProfile — posts the profile form submission and starts research
 *   handleRetryResearch — re-runs the last search for the active profile
 *
 * Lifted out of App.tsx to reduce its size and make the search logic
 * independently testable.
 */
export function useGrantSearch({
  onResearchStart,
  onResearchProgress,
  onResearchComplete,
  onResearchError,
  setBusy,
  setStage,
  setGrants,
}: UseGrantSearchOptions) {
  const researchInFlight = useRef(false);
  const [lastProfile, setLastProfile] = useState<OrganisationProfile | null>(null);

  const runResearch = useCallback(
    async (profile: OrganisationProfile) => {
      if (researchInFlight.current) return;
      researchInFlight.current = true;
      setBusy(true);
      setStage("researching");
      setLastProfile(profile);

      const researchSteps = isMockMode ? MOCK_RESEARCH_STEPS : LIVE_RESEARCH_STEPS;
      const initialState: ResearchState = {
        steps: researchSteps.map((label, i) => ({
          label,
          status: i === 0 ? ("active" as const) : ("pending" as const),
        })),
      };
      const messageId = onResearchStart(initialState);

      try {
        const handleProgress = (event: SseEvent) => {
          if (!event.stage) return;
          const stageIndexMap: Record<string, number> = {
            keywords: 0,
            search: 1,
            select: 2,
          };
          const activeIndex = stageIndexMap[event.stage] ?? 0;
          onResearchProgress(messageId, (blocks) =>
            blocks.map((block) => {
              if (block.type !== "research_status") return block;
              const steps = block.state.steps.map((step, idx) => {
                if (idx < activeIndex) return { ...step, status: "done" as const };
                if (idx === activeIndex) {
                  return {
                    ...step,
                    status: "active" as const,
                    detail: event.message || step.detail,
                  };
                }
                return { ...step, status: "pending" as const };
              });
              return { type: "research_status" as const, state: { steps } };
            }),
          );
        };

        const result = await grantService.searchGrants(profile, handleProgress);
        const grants = result.grants;

        // Mark all steps done
        onResearchProgress(messageId, (blocks) =>
          blocks.map((block) =>
            block.type === "research_status"
              ? {
                  type: "research_status" as const,
                  state: {
                    steps: block.state.steps.map((step) => ({ ...step, status: "done" as const })),
                  },
                }
              : block,
          ),
        );

        setGrants(grants);
        setStage("results");
        onResearchComplete(grants, result.sourceSummary, profile);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Research failed";
        onResearchError(messageId, message);
      } finally {
        researchInFlight.current = false;
        setBusy(false);
      }
    },
    [
      onResearchComplete,
      onResearchError,
      onResearchProgress,
      onResearchStart,
      setBusy,
      setGrants,
      setStage,
    ],
  );

  const handleRetryResearch = useCallback(() => {
    if (lastProfile) {
      void runResearch(lastProfile);
    }
  }, [lastProfile, runResearch]);

  return { runResearch, handleRetryResearch };
}
