import { useCallback, useRef, useState } from "react";
import { grantService } from "@/services";
import type { SseEvent } from "@/services/apiClient";
import type {
  ChatBlock,
  Grant,
  OrganisationProfile,
  ResearchSourceId,
  ResearchState,
  ResearchStep,
} from "@/types";

/** Steps shown while streaming results from the agent. */
const LIVE_RESEARCH_STEPS = [
  "Analysing profile & generating keywords",
  "Discovering opportunities in parallel",
  "Evaluating & ranking best matches",
];

const INITIAL_SOURCES: NonNullable<ResearchState["sources"]> = {
  eu_portal: {
    id: "eu_portal",
    label: "EU Portal",
    detail: "Horizon Europe / SEDIA",
    status: "pending",
  },
  web_discovery: {
    id: "web_discovery",
    label: "Web Discovery",
    detail: "National & regional funding sources",
    status: "pending",
  },
};

const statusRank: Record<ResearchStep["status"], number> = {
  pending: 0,
  active: 1,
  done: 2,
};

function advanceStatus(
  current: ResearchStep["status"],
  next: ResearchStep["status"],
): ResearchStep["status"] {
  return statusRank[next] > statusRank[current] ? next : current;
}

function sourceIdFor(data: Record<string, unknown> | undefined): ResearchSourceId | undefined {
  const tool = typeof data?.tool === "string" ? data.tool.toLowerCase() : "";
  const source = typeof data?.source === "string" ? data.source.toLowerCase() : "";
  if (tool.includes("web") || source === "web_search") return "web_discovery";
  if (tool.includes("eu") || source === "eu_portal") return "eu_portal";
  return undefined;
}

function detailForStep(event: SseEvent, finalCount: number | undefined): string | undefined {
  if (event.stage === "search") return "Searching EU Portal and Web Discovery in parallel.";
  if (event.stage === "select") {
    return finalCount !== undefined
      ? `${finalCount} strong recommendation${finalCount === 1 ? "" : "s"} selected.`
      : "Evaluating discovered opportunities against your profile.";
  }
  return event.message;
}

export function createInitialResearchState(): ResearchState {
  return {
    steps: LIVE_RESEARCH_STEPS.map((label, i) => ({
      label,
      status: i === 0 ? ("active" as const) : ("pending" as const),
    })),
    sources: {
      eu_portal: { ...INITIAL_SOURCES.eu_portal },
      web_discovery: { ...INITIAL_SOURCES.web_discovery },
    },
  };
}

export function applyResearchProgressEvent(state: ResearchState, event: SseEvent): ResearchState {
  if (!event.stage) return state;
  const data = event.data as Record<string, unknown> | undefined;
  const euCount = typeof data?.eu_count === "number" ? data.eu_count : undefined;
  const webCount = typeof data?.web_count === "number" ? data.web_count : undefined;
  const candidateCount =
    typeof data?.candidate_count === "number" ? data.candidate_count : undefined;
  const finalCount = typeof data?.final_count === "number" ? data.final_count : undefined;
  const sourceId = sourceIdFor(data);
  const stepDetail = detailForStep(event, finalCount);
  const sourceFailed =
    event.event === "error" || (event.message ? /\bfailed\b/i.test(event.message) : false);

  const activeIndex = event.stage === "keywords" ? 0 : event.stage === "search" ? 1 : 2;
  const steps = state.steps.map((step, idx) => {
    if (idx < activeIndex) return { ...step, status: "done" as const };
    if (idx === activeIndex) {
      return {
        ...step,
        status: advanceStatus(step.status, "active"),
        detail: stepDetail || step.detail,
        euCount: euCount ?? step.euCount,
        webCount: webCount ?? step.webCount,
        candidateCount: candidateCount ?? step.candidateCount,
        selectedCount: finalCount ?? step.selectedCount,
      };
    }
    return step;
  });

  const currentSources = state.sources ?? INITIAL_SOURCES;
  const sources = {
    eu_portal: { ...currentSources.eu_portal },
    web_discovery: { ...currentSources.web_discovery },
  };

  if (event.stage === "search") {
    if (sourceId) {
      const current = sources[sourceId];
      sources[sourceId] = {
        ...current,
        status: sourceFailed ? "error" : current.status === "done" ? "done" : "active",
        candidateCount:
          sourceId === "eu_portal"
            ? (euCount ?? current.candidateCount)
            : (webCount ?? current.candidateCount),
        error: sourceFailed ? event.message : current.error,
      };
    } else {
      sources.eu_portal.status = sources.eu_portal.status === "done" ? "done" : "active";
      sources.web_discovery.status = sources.web_discovery.status === "done" ? "done" : "active";
    }
  } else if (activeIndex >= 2) {
    sources.eu_portal = {
      ...sources.eu_portal,
      status: sources.eu_portal.status === "error" ? "error" : "done",
      candidateCount: euCount ?? sources.eu_portal.candidateCount,
    };
    sources.web_discovery = {
      ...sources.web_discovery,
      status: sources.web_discovery.status === "error" ? "error" : "done",
      candidateCount: webCount ?? sources.web_discovery.candidateCount,
    };
  }

  return {
    ...state,
    steps,
    euCount: euCount ?? state.euCount,
    webCount: webCount ?? state.webCount,
    sources,
  };
}

function completeResearchState(state: ResearchState): ResearchState {
  return {
    ...state,
    steps: state.steps.map((step) => ({ ...step, status: "done" as const })),
    sources: state.sources
      ? {
          eu_portal: {
            ...state.sources.eu_portal,
            status: state.sources.eu_portal.status === "error" ? "error" : "done",
          },
          web_discovery: {
            ...state.sources.web_discovery,
            status: state.sources.web_discovery.status === "error" ? "error" : "done",
          },
        }
      : undefined,
  };
}

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
    allCandidates?: Grant[],
  ) => void;
  /** Called with an error message if the search fails. */
  onResearchError: (messageId: string, error: string) => void;
  /** Outer busy setter — shared with the rest of App so the composer locks. */
  setBusy: (busy: boolean) => void;
  /** Conversation-level setters. */
  setStage: (stage: "researching" | "results") => void;
  setGrants: (grants: Grant[]) => void;
  /** Returns all grant IDs that have already been shown in this conversation. */
  getExcludedGrantIds?: () => string[];
  /** Returns the active conversation ID to link and persist search batches in DB. */
  getConversationId?: () => string | undefined;
}

/**
 * useGrantSearch
 *
 * Encapsulates the full grant-search lifecycle:
 *   runResearch        — triggers a live/mock search, streams progress events
 *   handleSubmitProfile — posts the profile form submission and starts research
 *   handleRetryResearch — re-runs the search excluding previously shown grants
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
  getExcludedGrantIds,
  getConversationId,
}: UseGrantSearchOptions) {
  const researchInFlight = useRef(false);
  const [lastProfile, setLastProfile] = useState<OrganisationProfile | null>(null);

  const runResearch = useCallback(
    async (
      profile: OrganisationProfile,
      options?: { excludedGrantIds?: string[]; userRequest?: string; conversationId?: string },
    ) => {
      if (researchInFlight.current) return;
      researchInFlight.current = true;
      setBusy(true);
      setStage("researching");
      setLastProfile(profile);

      const initialState = createInitialResearchState();
      const messageId = onResearchStart(initialState);

      try {
        const handleProgress = (event: SseEvent) => {
          onResearchProgress(messageId, (blocks) =>
            blocks.map((block) =>
              block.type === "research_status"
                ? {
                    type: "research_status" as const,
                    state: applyResearchProgressEvent(block.state, event),
                  }
                : block,
            ),
          );
        };

        const excludedIds = options?.excludedGrantIds ?? getExcludedGrantIds?.() ?? [];
        const conversationId = options?.conversationId ?? getConversationId?.();
        const result = await grantService.searchGrants(
          profile,
          handleProgress,
          excludedIds,
          conversationId,
        );
        const grants = result.grants;

        // Mark all steps done
        onResearchProgress(messageId, (blocks) =>
          blocks.map((block) =>
            block.type === "research_status"
              ? {
                  type: "research_status" as const,
                  state: completeResearchState(block.state),
                }
              : block,
          ),
        );

        setGrants(grants);
        setStage("results");
        onResearchComplete(grants, result.sourceSummary, profile, result.allCandidates);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Research failed";
        onResearchError(messageId, message);
      } finally {
        researchInFlight.current = false;
        setBusy(false);
      }
    },
    [
      getConversationId,
      getExcludedGrantIds,
      onResearchComplete,
      onResearchError,
      onResearchProgress,
      onResearchStart,
      setBusy,
      setGrants,
      setStage,
    ],
  );

  const handleRetryResearch = useCallback(
    (options?: { userRequest?: string; excludedGrantIds?: string[] }) => {
      if (lastProfile) {
        const excludedIds = options?.excludedGrantIds ?? getExcludedGrantIds?.() ?? [];
        void runResearch(lastProfile, {
          excludedGrantIds: excludedIds,
          userRequest: options?.userRequest,
        });
      }
    },
    [getExcludedGrantIds, lastProfile, runResearch],
  );

  return { runResearch, handleRetryResearch };
}
