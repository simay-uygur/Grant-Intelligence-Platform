import { useCallback, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { grantService, isMockMode } from "@/services";
import { MOCK_GRANTS } from "@/data/mockGrants";
import type {
  ApplicationStage,
  ChatBlock,
  ChatMessage,
  Grant,
  OrganisationProfile,
  ResearchState,
} from "@/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import type { BlockCallbacks } from "@/components/chat/BlockRenderer";

const COMPOSER_PLACEHOLDERS: Record<ApplicationStage, string> = {
  welcome: "Describe your organisation and funding needs…",
  collecting_information: "Add any details that may help refine your profile…",
  researching: "Research is in progress…",
  results: "Ask about one of these grants…",
  application: "Ask to revise, expand, or improve this application…",
};

const RESEARCH_STEPS = [
  "Understanding organisation profile",
  "Analysing funding requirements",
  "Checking geographical eligibility",
  "Searching European grant programmes",
  "Comparing funding amounts",
  "Reviewing deadlines",
  "Ranking the strongest matches",
];

const DEMO_PROFILE: OrganisationProfile = {
  organisationName: "Northlight Robotics",
  organisationType: "SME",
  organisationDescription:
    "A 22-person robotics SME building AI-driven quality inspection for European manufacturers.",
  country: "Germany",
  region: "Munich, Bavaria",
  projectTitle: "OptiScan: Explainable AI for Zero-Defect Manufacturing",
  projectDescription:
    "Pilot deployment of an explainable computer-vision platform across three EU factories to reduce defect rates and energy waste.",
  fundingAmount: "€500,000 – €1,000,000",
  projectStartDate: "2026-06-01",
  projectDuration: "24 months",
  sector: "Digital & AI",
  eligibilityConstraints: "SME status must be maintained throughout the project.",
};

export function App() {
  const c = useConversations();
  const [busy, setBusy] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const researchInFlight = useRef(false);

  const setBlocks = c.updateMessageBlocks;
  const appendMessage = c.appendMessage;
  const uid = c.uid;

  const now = () => new Date().toISOString();

  const askAssistant = useCallback(
    (blocks: ChatBlock[]) => {
      const msg: ChatMessage = {
        id: uid(),
        role: "assistant",
        createdAt: now(),
        blocks,
      };
      appendMessage(msg);
      return msg.id;
    },
    [appendMessage, uid],
  );

  const askUser = useCallback(
    (blocks: ChatBlock[]) => {
      const msg: ChatMessage = {
        id: uid(),
        role: "user",
        createdAt: now(),
        blocks,
      };
      appendMessage(msg);
      return msg.id;
    },
    [appendMessage, uid],
  );

  const runResearch = useCallback(
    async (profile: OrganisationProfile, initialError?: boolean) => {
      if (researchInFlight.current) return;
      researchInFlight.current = true;
      setBusy(true);
      c.setStage("researching");

      const state: ResearchState = {
        steps: RESEARCH_STEPS.map((label, i) => ({
          label,
          status: i === 0 ? "active" : "pending",
        })),
      };
      const messageId = askAssistant([
        { type: "research_status", state },
      ]);

      try {
        for (let i = 0; i < RESEARCH_STEPS.length; i++) {
          await new Promise((r) => setTimeout(r, 450));
          setBlocks(messageId, (blocks) =>
            blocks.map((b) => {
              if (b.type !== "research_status") return b;
              const steps = b.state.steps.map((s, idx) => {
                if (idx < i + 1) return { ...s, status: "done" as const };
                if (idx === i + 1) return { ...s, status: "active" as const };
                return { ...s, status: "pending" as const };
              });
              return { type: "research_status", state: { steps } };
            }),
          );
        }

        if (initialError) throw new Error("Simulated network error");

        const grants = await grantService.searchGrants(profile);
        c.setGrants(grants);
        c.setStage("results");
        askAssistant([
          {
            type: "text",
            text: `I found ${grants.length} strong matches for ${profile.organisationName}. Here are the top three, ranked by fit:`,
          },
          { type: "grant_results", grants },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Research failed";
        setBlocks(messageId, (blocks) =>
          blocks.map((b) =>
            b.type === "research_status"
              ? {
                  type: "research_status",
                  state: { ...b.state, error: message },
                }
              : b,
          ),
        );
      } finally {
        researchInFlight.current = false;
        setBusy(false);
      }
    },
    [askAssistant, c, setBlocks],
  );

  const handleSubmitProfile = useCallback(
    (profile: OrganisationProfile) => {
      c.setProfile(profile);
      askUser([
        {
          type: "text",
          text: `Here are the details:\n• Organisation: ${profile.organisationName} (${profile.organisationType})\n• Country: ${profile.country}${profile.region ? `, ${profile.region}` : ""}\n• Sector: ${profile.sector}\n• Project: ${profile.projectTitle}\n• Budget: ${profile.fundingAmount}\n• Duration: ${profile.projectDuration}`,
        },
      ]);
      askAssistant([
        {
          type: "text",
          text: "Thanks — that's enough to start. Let me research the best matches across European programmes.",
        },
      ]);
      void runResearch(profile);
    },
    [askAssistant, askUser, c, runResearch],
  );

  const handleRetryResearch = useCallback(() => {
    if (c.activeConversation?.profile) {
      void runResearch(c.activeConversation.profile);
    }
  }, [c.activeConversation, runResearch]);

  const handleAskGrant = useCallback(
    (grant: Grant) => {
      askUser([{ type: "text", text: `Tell me more about ${grant.title}.` }]);
      askAssistant([
        {
          type: "text",
          text: `${grant.title} is part of the ${grant.programme}. It offers ${grant.fundingAmount} as ${grant.fundingType.toLowerCase()}, with a deadline on ${grant.deadline}.\n\nKey requirements:\n${grant.requirements.map((r) => `• ${r}`).join("\n")}\n\nOpen the source link on the card for the official call text, or start an application to draft your proposal here.`,
        },
      ]);
    },
    [askAssistant, askUser],
  );

  const handleStartApplication = useCallback(
    async (grant: Grant) => {
      if (!c.activeConversation?.profile) return;
      setBusy(true);
      try {
        const doc = await grantService.startApplication(
          grant,
          c.activeConversation.profile,
        );
        c.setDocument(doc, grant.id);
        c.setStage("application");
        askAssistant([
          {
            type: "success",
            message: `Application draft created for ${grant.title}. Edit any section, or use Rewrite with AI.`,
          },
          { type: "document", documentId: doc.id },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [askAssistant, c],
  );

  const handleUserSend = useCallback(
    (text: string) => {
      askUser([{ type: "text", text }]);
      const stage = c.activeConversation?.stage ?? "welcome";
      if (stage === "welcome") {
        c.setStage("collecting_information");
        askAssistant([
          {
            type: "text",
            text: "Great — to match you to the strongest calls, please complete this short profile.",
          },
          { type: "structured_form" },
        ]);
      } else if (stage === "application") {
        askAssistant([
          {
            type: "text",
            text: "You can edit any section directly, click Rewrite with AI to regenerate it, or export the whole document as PDF or Word.",
          },
        ]);
      } else {
        askAssistant([
          {
            type: "text",
            text: "I've noted that. You can keep refining the draft, ask about any of the recommended grants, or start a new conversation for a different funding scenario.",
          },
        ]);
      }
    },
    [askAssistant, askUser, c],
  );

  const runDemo = useCallback(async () => {
    if (demoRunning || busy) return;
    setDemoRunning(true);
    try {
      c.newConversation();
      await new Promise((r) => setTimeout(r, 200));
      askUser([
        {
          type: "text",
          text: "We're an SME building AI vision for European factories and want to fund a 24-month pilot around €800K.",
        },
      ]);
      c.setStage("collecting_information");
      askAssistant([
        {
          type: "text",
          text: "Great — here's a pre-filled profile based on what you said. Adjust anything before I research.",
        },
        { type: "structured_form", profile: DEMO_PROFILE },
      ]);
      await new Promise((r) => setTimeout(r, 500));
      c.setProfile(DEMO_PROFILE);
      askUser([
        {
          type: "text",
          text: `Profile confirmed for ${DEMO_PROFILE.organisationName}.`,
        },
      ]);
      askAssistant([
        {
          type: "text",
          text: "Perfect. Researching the strongest European matches now…",
        },
      ]);
      await runResearch(DEMO_PROFILE);
      await new Promise((r) => setTimeout(r, 400));
      await handleStartApplication(MOCK_GRANTS[0]);
    } finally {
      setDemoRunning(false);
    }
  }, [askAssistant, askUser, busy, c, demoRunning, handleStartApplication, runResearch]);

  const callbacks: BlockCallbacks = useMemo(
    () => ({
      onSubmitProfile: handleSubmitProfile,
      onRetryResearch: handleRetryResearch,
      onAskGrant: handleAskGrant,
      onStartApplication: handleStartApplication,
      onSectionChange: c.updateDocumentSection,
      getDocument: (id) =>
        c.activeConversation?.document?.id === id
          ? c.activeConversation.document
          : undefined,
      getProfile: () => c.activeConversation?.profile,
      getGrantById: (id) =>
        c.activeConversation?.grants?.find((g) => g.id === id) ??
        MOCK_GRANTS.find((g) => g.id === id),
      formDisabled: busy,
    }),
    [busy, c.activeConversation, c.updateDocumentSection, handleAskGrant, handleRetryResearch, handleStartApplication, handleSubmitProfile],
  );

  if (!c.hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading Grant Intelligence…
      </div>
    );
  }

  const active = c.activeConversation;

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to conversation
      </a>
      <Sidebar
        conversations={c.conversations}
        activeId={c.activeId}
        onSelect={c.selectConversation}
        onNew={c.newConversation}
        onDelete={c.deleteConversation}
      />

      <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
          <div className="min-w-0">
            <h1
              className="truncate text-sm font-semibold text-foreground"
              title={active?.title ?? "No conversation"}
            >
              {active?.title ?? "No conversation"}
            </h1>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected · {isMockMode ? "Mock mode" : "API mode"}
              </span>
              {active && (
                <span className="capitalize">
                  Stage: {active.stage.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
          {active?.stage === "welcome" && (
            <button
              type="button"
              onClick={runDemo}
              disabled={demoRunning || busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {demoRunning ? "Running demo…" : "Run demo"}
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {active ? (
            <MessageList messages={active.messages} callbacks={callbacks} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Start a new conversation from the sidebar.
            </div>
          )}
          {/* bottom spacer so composer never hides content */}
          <div className="h-4" />
        </div>

        <Composer
          disabled={busy || !active}
          onSend={handleUserSend}
          placeholder={
            active ? COMPOSER_PLACEHOLDERS[active.stage] : undefined
          }
        />
      </main>
    </div>
  );
}
