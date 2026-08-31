import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Menu, MessageSquarePlus, Play } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useApplications } from "@/hooks/useApplications";
import { useShortlist } from "@/hooks/useShortlist";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useStickToBottomScroll } from "@/hooks/useStickToBottomScroll";
import { LoginPage } from "@/components/auth/LoginPage";
import { grantService, isMockMode } from "@/services";
import { cn } from "@/lib/utils";
import { MOCK_GRANTS } from "@/data/mockGrants";
import type {
  ApplicationStage,
  ChatBlock,
  ChatMessage,
  Grant,
  OrganisationProfile,
  ResearchState,
} from "@/types";
import { Sidebar, MobileSidebar, type MainView } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PipelineDashboard } from "@/components/PipelineDashboard";
import { SavedGrants } from "@/components/SavedGrants";
import {
  DocumentWorkspace,
  WorkspaceExportControl,
} from "@/components/documents/DocumentWorkspace";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { Button } from "@/components/ui/button";
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

// Grant Q&A is answered locally by matching simple keywords against the
// question and quoting the matching Grant field(s) — never invented, never
// a real AI call. "Fact" answers quote structured fields verbatim; the
// "why it matches" answer is explicitly labelled as the mock assistant's
// canned explanation, since it's interpretive rather than a raw field.
function answerAboutGrant(question: string, grant: Grant): ChatBlock[] {
  const q = question.toLowerCase();

  if (/eligib/.test(q)) {
    return [
      {
        type: "text",
        text: `From this grant's record — organisation eligibility: ${grant.organisationEligibility.join(", ")}. Eligible countries / regions: ${grant.eligibleCountries.join(", ")}.`,
      },
    ];
  }
  if (/fund|amount|budget|money|€|much/.test(q)) {
    return [
      {
        type: "text",
        text: `From this grant's record — funding: ${grant.fundingAmount} (${grant.fundingType}).`,
      },
    ];
  }
  if (/deadline|when|due|close|date/.test(q)) {
    return [
      {
        type: "text",
        text: `From this grant's record — deadline: ${grant.deadline}.`,
      },
    ];
  }
  if (/match|why|fit|suit|align/.test(q)) {
    return [
      {
        type: "text",
        text: `Sample result — ${grant.whyItMatches}`,
      },
    ];
  }

  return [
    {
      type: "text",
      text: `From this grant's record, I can answer questions about eligibility, funding amount, the deadline, or why ${grant.title} matches your project.`,
    },
    {
      type: "text",
      text: "Sample result — this is a simulated response using only the demo data shown for this grant, not a live AI model. Try one of the suggested questions below, or start the application when you're ready.",
    },
  ];
}

// Same idea as answerAboutGrant: a few keyword checks against what the
// user actually typed, never a real intent model. The NEXT step is always
// the same profile form regardless — this only changes the sentence that
// leads into it, so an opener isn't met with a reply that ignores it.
const DEFAULT_WELCOME_REPLY =
  "Great — to match you to the strongest calls, please complete this short profile.";

function openingAcknowledgement(text: string): string {
  const q = text.toLowerCase();

  if (/compar|funding opportunit/.test(q)) {
    return "Happy to help you compare funding options — first, a quick profile so I can match the strongest calls:";
  }
  if (/draft|application|write/.test(q)) {
    return "Let's get your application started — first, a short profile so the draft fits the right grant:";
  }
  if (/eligib|check/.test(q)) {
    return "I can check what you're eligible for — first, a quick profile so I can match you accurately:";
  }

  return DEFAULT_WELCOME_REPLY;
}

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
  projectStartDate: "2027-06-01",
  projectDuration: "24 months",
  sector: "Digital & AI",
  eligibilityConstraints: "SME status must be maintained throughout the project.",
};

/**
 * The single-route app's auth gate — no router route added (see the
 * inspection note before this round's diff): a small wrapper around the
 * existing single-page shell, mirroring how useConversations already gates
 * its own hydration. AppShell's hooks (conversations, applications, etc.)
 * only start running once actually authed, so nothing behind the login
 * screen is doing work before it's reached.
 */
export function App() {
  const auth = useAuth();

  if (!auth.hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading Grant Intelligence…
      </div>
    );
  }

  if (!auth.authed) {
    return <LoginPage onSignIn={auth.signIn} />;
  }

  return <AppShell onSignOut={auth.signOut} />;
}

function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const c = useConversations();
  // The single useApplications instance for the whole app. Both writers live
  // here — the chat (starting an application) and the pipeline (changing a
  // status) — so neither can overwrite the other with a stale array.
  const apps = useApplications();
  const addApplication = apps.addApplication;
  const applications = apps.applications;
  const updateApplicationStatus = apps.updateStatus;
  // Only for the sidebar's saved count. Safe alongside the instances in
  // GrantResults and SavedGrants: useShortlist writes on mutation and
  // broadcasts, so every instance stays in step.
  const shortlist = useShortlist();
  const [busy, setBusy] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Which main view is showing. Local, non-persisted UI state: the pipeline
  // dashboard is global across conversations, so it's a sibling view of the
  // chat rather than a block inside one — the app still has a single route.
  const [mainView, setMainView] = useState<MainView>("chat");
  const [composerValue, setComposerValue] = useState("");
  const [askingAboutGrant, setAskingAboutGrant] = useState<Grant | null>(null);
  const researchInFlight = useRef(false);
  const isMobile = useIsMobile();

  // If the viewport grows past the mobile breakpoint while the sheet is open
  // (resize/rotate), close it so it can't sit open over the now-visible desktop sidebar.
  useEffect(() => {
    if (!isMobile) setMobileSidebarOpen(false);
  }, [isMobile]);

  // Grant Q&A context is a local UI concern, not part of the stored
  // conversation — drop it whenever the active conversation changes so it
  // can't leak across conversations or survive a switch back and forth.
  useEffect(() => {
    setAskingAboutGrant(null);
  }, [c.activeId]);

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
      const messageId = askAssistant([{ type: "research_status", state }]);

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
            text:
              grants.length === 0
                ? `I couldn't find anything in the demo dataset that matches ${profile.organisationName} on every criterion. Here's what usually helps:`
                : `I found ${grants.length} strong matches for ${profile.organisationName}. Here are the top three, ranked by fit:`,
          },
          // Sent even when empty: GrantResults owns the no-match state and
          // the "search again" action, so the answer isn't a dead end.
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
      setAskingAboutGrant(grant);
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
      setAskingAboutGrant(null);
      setBusy(true);
      const profile = c.activeConversation.profile;
      try {
        const doc = await grantService.startApplication(grant, profile);
        c.setDocument(doc, grant.id);
        c.setStage("application");
        // The pipeline row is a SUMMARY: the draft body stays in
        // conversation.document, and only what the board displays is mirrored
        // into gi.applications.v1. Upserted on grantId, so a repeat start
        // refreshes this row rather than adding a second one.
        addApplication({
          id: `app-${doc.id}`,
          grantId: grant.id,
          grantTitle: grant.title,
          grantOrganisation: grant.programme,
          applicantOrganisation: profile.organisationName,
          status: "drafting",
          fundingAmount: grant.fundingAmount,
          deadline: grant.deadline,
          updatedAt: new Date().toISOString(),
        });
        askAssistant([
          {
            type: "success",
            message: `Application draft created for ${grant.title}. Edit any section, or use Rewrite with AI.`,
          },
          { type: "document", documentId: doc.id },
        ]);
      } catch (err) {
        // Previously uncaught: a rejection here left the UI sitting on the
        // results with no explanation. The stage is deliberately not moved,
        // so "Start application" on the grant card is still there to retry.
        askAssistant([
          {
            type: "error",
            message: `${err instanceof Error ? err.message : "The draft couldn't be generated."} Nothing was saved — use "Start application" on ${grant.title} to try again.`,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [addApplication, askAssistant, c],
  );

  const handleUserSend = useCallback(
    (text: string) => {
      askUser([{ type: "text", text }]);
      const stage = c.activeConversation?.stage ?? "welcome";
      if (askingAboutGrant) {
        askAssistant(answerAboutGrant(text, askingAboutGrant));
      } else if (stage === "welcome") {
        c.setStage("collecting_information");
        askAssistant([
          { type: "text", text: openingAcknowledgement(text) },
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
    [askAssistant, askUser, askingAboutGrant, c],
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
      // Deliberately reaches into the mock catalogue directly rather than
      // grantService: this is the scripted demo choosing a specific,
      // known grant for its narrative, not a lookup a service should
      // provide — searchGrants() has no "get grant by index" contract.
      await handleStartApplication(MOCK_GRANTS[0]);
    } finally {
      setDemoRunning(false);
    }
  }, [askAssistant, askUser, busy, c, demoRunning, handleStartApplication, runResearch]);

  // Picking a conversation from the sidebar implies you want to read it, so
  // these pair the existing (untouched) conversation actions with a switch
  // back to the chat view. View state only — no conversation logic changes.
  const selectConversation = c.selectConversation;
  const newConversation = c.newConversation;

  const selectConversationInChat = useCallback(
    (id: string) => {
      setMainView("chat");
      selectConversation(id);
    },
    [selectConversation],
  );

  const newConversationInChat = useCallback(() => {
    setMainView("chat");
    newConversation();
  }, [newConversation]);

  const callbacks: BlockCallbacks = useMemo(
    () => ({
      onSubmitProfile: handleSubmitProfile,
      onRetryResearch: handleRetryResearch,
      onAskGrant: handleAskGrant,
      onStartApplication: handleStartApplication,
      onSectionChange: c.updateDocumentSection,
      getDocument: (id) =>
        c.activeConversation?.document?.id === id ? c.activeConversation.document : undefined,
      getProfile: () => c.activeConversation?.profile,
      // Falls back to the mock catalogue when a document references a grant
      // that's no longer in this conversation's current grants (e.g. after
      // a second research pass replaced it). This lookup is synchronous
      // because it runs during render (BlockRenderer -> ApplicationDocumentView).
      // TODO(api): once a real backend exists, replace this fallback with
      // GET /grants/{id} — that will require getGrantById to become async
      // and the render path here to move to a loading-aware pattern; not
      // done now since it's a real behavioural change, not just a data-source swap.
      getGrantById: (id) =>
        c.activeConversation?.grants?.find((g) => g.id === id) ??
        MOCK_GRANTS.find((g) => g.id === id),
      // The editor's pipeline-status control, served off the SAME
      // useApplications instance the board uses — one store, so a status
      // changed in the draft moves the card and vice versa. A chat-created
      // application's row id is `app-${doc.id}`; no match means no control.
      getApplicationStatus: (documentId) =>
        applications.find((a) => a.id === `app-${documentId}`)?.status,
      onUpdateApplicationStatus: (documentId, status) =>
        updateApplicationStatus(`app-${documentId}`, status),
      onViewInPipeline: () => setMainView("pipeline"),
      onOpenWorkspace: () => setMainView("workspace"),
      formDisabled: busy,
      // "Has the search finished", not "did it find anything" — a completed
      // search that matched nothing must still stop the research card's
      // preparing-results skeletons, or they'd spin forever above the
      // no-matches state.
      hasGrantResults: c.activeConversation?.grants !== undefined,
    }),
    [
      applications,
      updateApplicationStatus,
      busy,
      c.activeConversation,
      c.updateDocumentSection,
      handleAskGrant,
      handleRetryResearch,
      handleStartApplication,
      handleSubmitProfile,
    ],
  );

  const active = c.activeConversation;

  // Same lookup as callbacks.getGrantById (falls back to the mock catalogue
  // when the document's grant has fallen out of this conversation's current
  // `grants` list) — computed directly here since the workspace is rendered
  // outside BlockRenderer and doesn't go through `callbacks`.
  const workspaceGrant = active?.document
    ? (active.grants?.find((g) => g.id === active.document?.grantId) ??
      MOCK_GRANTS.find((g) => g.id === active.document?.grantId))
    : undefined;

  // Same id scheme as callbacks.getApplicationStatus (app-${documentId}) —
  // read-only display in the workspace header, so no new callback needed.
  const workspacePipelineStatus = active?.document
    ? applications.find((a) => a.id === `app-${active.document?.id}`)?.status
    : undefined;

  // Show a lightweight "assistant is working" indicator for gaps where busy
  // work is happening but no research_status block (which has its own
  // step-by-step progress and recommendation-skeleton UI) is already
  // covering that role — that card owns the loading story from the first
  // step through to grant results actually landing.
  const showProcessingIndicator = useMemo(() => {
    if (!active || !busy) return false;
    const last = active.messages[active.messages.length - 1];
    const lastBlock = last?.blocks[last.blocks.length - 1];
    const hasGrantResults = Boolean(active.grants?.length);
    const researchCoveringIndicator =
      lastBlock?.type === "research_status" && !lastBlock.state.error && !hasGrantResults;
    return !researchCoveringIndicator;
  }, [active, busy]);

  const { scrollContainerRef, scrollBottomRef, showScrollButton, scrollToBottom } =
    useStickToBottomScroll(active, showProcessingIndicator);

  if (!c.hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading Grant Intelligence…
      </div>
    );
  }

  const isFreshWelcome = Boolean(
    active && active.stage === "welcome" && active.messages.length <= 1 && !demoRunning,
  );

  const headerTitle =
    mainView === "pipeline"
      ? "Application pipeline"
      : mainView === "saved"
        ? "Saved grants"
        : mainView === "workspace"
          ? (active?.document?.grantTitle ?? "Document workspace")
          : (active?.title ?? "No conversation");

  return (
    <div className="h-dvh-safe flex w-full overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-foreground"
      >
        Skip to conversation
      </a>
      <Sidebar
        conversations={c.conversations}
        activeId={c.activeId}
        onSelect={selectConversationInChat}
        onNew={newConversationInChat}
        onRename={c.renameConversation}
        onDelete={c.deleteConversation}
        mainView={mainView}
        onSelectView={setMainView}
        savedCount={shortlist.savedGrants.length}
        onSignOut={onSignOut}
      />
      <MobileSidebar
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
        conversations={c.conversations}
        activeId={c.activeId}
        onSelect={selectConversationInChat}
        onNew={newConversationInChat}
        onRename={c.renameConversation}
        onDelete={c.deleteConversation}
        mainView={mainView}
        onSelectView={setMainView}
        savedCount={shortlist.savedGrants.length}
        onSignOut={onSignOut}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-3 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open conversation menu"
              className="shrink-0 rounded-lg md:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground" title={headerTitle}>
                {headerTitle}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Connected · {isMockMode ? "Demo mode" : "API mode"}
                </span>
                {mainView === "chat" && active && (
                  <span className="capitalize">Stage: {active.stage.replace(/_/g, " ")}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mainView === "chat" && active?.stage === "welcome" && (
              <button
                type="button"
                onClick={runDemo}
                disabled={demoRunning || busy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {demoRunning ? "Running demo…" : "Run demo"}
              </button>
            )}
            {mainView === "workspace" && active?.document && (
              <WorkspaceExportControl doc={active.document} />
            )}
            <ThemeToggle />
          </div>
        </header>

        {!c.persistenceOk && (
          <div
            role="status"
            aria-live="polite"
            className="shrink-0 border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning sm:px-6"
          >
            Changes aren&apos;t being saved to this browser right now — local storage may be full or
            unavailable (for example, in private browsing). Keep this tab open so you don&apos;t
            lose your work.
          </div>
        )}

        {/* Chat and pipeline are sibling main views. The chat stays mounted
            (just hidden) while the pipeline is open so the message list keeps
            its scroll position and stick-to-bottom listener across switches. */}
        <div className={cn("relative min-h-0 flex-1", mainView !== "chat" && "hidden")}>
          <div ref={scrollContainerRef} className="h-full overflow-y-auto">
            {active ? (
              isFreshWelcome ? (
                <WelcomeScreen onQuickStart={handleUserSend} onFillComposer={setComposerValue} />
              ) : (
                <MessageList
                  messages={active.messages}
                  callbacks={callbacks}
                  showProcessingIndicator={showProcessingIndicator}
                />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MessageSquarePlus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">No conversation selected</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Start a new conversation to research grants for your organisation.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={c.newConversation}
                  className="rounded-lg bg-brand text-brand-foreground shadow-sm hover:bg-brand/90"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  New conversation
                </Button>
              </div>
            )}
            {/* bottom spacer so composer never hides content, and scroll anchor */}
            <div ref={scrollBottomRef} className="h-4" />
          </div>

          {showScrollButton && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => scrollToBottom("smooth")}
                aria-label="Scroll to latest messages"
                className="pointer-events-auto h-auto gap-1.5 rounded-full border-border bg-card/95 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur hover:bg-muted"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Scroll to latest
              </Button>
            </div>
          )}
        </div>

        {mainView === "saved" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SavedGrants onGoToChat={() => setMainView("chat")} />
          </div>
        )}

        {mainView === "workspace" && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <DocumentWorkspace
              doc={active?.document}
              profile={active?.profile}
              grant={workspaceGrant}
              pipelineStatus={workspacePipelineStatus}
              onSectionChange={c.updateDocumentSection}
              onGoToChat={() => setMainView("chat")}
            />
          </div>
        )}

        {mainView === "pipeline" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* The pipeline's empty state sends people back to the chat; it
                reuses this same view toggle rather than adding a route. */}
            <PipelineDashboard
              onGoToChat={() => setMainView("chat")}
              applications={apps.applications}
              hydrated={apps.hydrated}
              persistenceOk={apps.persistenceOk}
              updateStatus={apps.updateStatus}
              // Read-only, for working out which conversation a card links
              // back to; the open action reuses the same switch-to-chat +
              // activate handler the sidebar already uses.
              conversations={c.conversations}
              onOpenConversation={selectConversationInChat}
            />
          </div>
        )}

        <div className={cn("shrink-0", mainView !== "chat" && "hidden")}>
          <Composer
            value={composerValue}
            onValueChange={setComposerValue}
            disabled={busy || !active}
            onSend={handleUserSend}
            placeholder={active ? COMPOSER_PLACEHOLDERS[active.stage] : undefined}
            grantContext={askingAboutGrant}
            onClearGrantContext={() => setAskingAboutGrant(null)}
          />
        </div>
      </main>
    </div>
  );
}
