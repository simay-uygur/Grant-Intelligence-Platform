import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowDown, Menu, MessageSquarePlus, Play } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useApplications } from "@/hooks/useApplications";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStickToBottomScroll } from "@/hooks/useStickToBottomScroll";
import {
  applicationService,
  backendService,
  chatService,
  grantService,
  isMockMode,
} from "@/services";
import { clearAuthToken, logout, type SseEvent } from "@/services/apiClient";
import type { ChatReply } from "@/services/ChatService";
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
import { AccountModal } from "@/components/AccountModal";
import { Sidebar, MobileSidebar, type MainView } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PipelineDashboard } from "@/components/PipelineDashboard";
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

const MOCK_RESEARCH_STEPS = [
  "Understanding organisation profile",
  "Analysing funding requirements",
  "Checking geographical eligibility",
  "Searching European grant programmes",
  "Comparing funding amounts",
  "Reviewing deadlines",
  "Ranking the strongest matches",
];

const LIVE_RESEARCH_STEPS = [
  "Generating search keywords",
  "Searching EU Horizon API opportunities",
  "Filtering & ranking best matches",
];
const AUTH_TOKEN_KEY = "gi.auth.token";

type BackendConnection =
  | { status: "local" }
  | { status: "checking" }
  | { status: "connected"; appName: string; version: string }
  | { status: "unavailable" };

type BackendHistorySync =
  | { status: "idle" }
  | { status: "syncing"; conversationId: string }
  | { status: "synced"; conversationId: string }
  | { status: "error"; conversationId: string; message: string };

function chatReplyBlocks(reply: ChatReply): ChatBlock[] {
  return [
    { type: "text", text: reply.assistantMessage },
    ...reply.followUpQuestions.map((question): ChatBlock => ({ type: "question", text: question })),
  ];
}

const missingGrantFact = (grant: Grant, label: string): ChatBlock[] => [
  {
    type: "text",
    text: `${label} was not supplied by ${grant.source || "this grant's source"} for this result. Open the official source when available for the authoritative call details.`,
  },
];

// Grant Q&A remains local and only reports fields present on the record.
function answerAboutGrant(question: string, grant: Grant): ChatBlock[] {
  const q = question.toLowerCase();

  if (/eligib/.test(q)) {
    const organisation = grant.organisationEligibility?.join(", ");
    const countries = grant.eligibleCountries?.join(", ");
    if (!organisation && !countries) return missingGrantFact(grant, "Eligibility information");
    return [
      {
        type: "text",
        text: `From this grant's record — ${organisation ? `organisation eligibility: ${organisation}. ` : ""}${countries ? `Eligible countries / regions: ${countries}.` : ""}`.trim(),
      },
    ];
  }
  if (/fund|amount|budget|money|€|much/.test(q)) {
    if (!grant.fundingAmount && !grant.fundingType) {
      return missingGrantFact(grant, "Funding information");
    }
    return [
      {
        type: "text",
        text: `From this grant's record — funding: ${[grant.fundingAmount, grant.fundingType].filter(Boolean).join(" · ")}.`,
      },
    ];
  }
  if (/deadline|when|due|close|date/.test(q)) {
    if (!grant.deadline) return missingGrantFact(grant, "The deadline");
    return [
      {
        type: "text",
        text: `From this grant's record — deadline: ${grant.deadline}.`,
      },
    ];
  }
  if (/match|why|fit|suit|align/.test(q)) {
    if (!grant.whyItMatches) return missingGrantFact(grant, "A match explanation");
    return [
      {
        type: "text",
        text:
          grant.provenance === "live"
            ? `Source match explanation — ${grant.whyItMatches}`
            : `Demo match explanation — ${grant.whyItMatches}`,
      },
    ];
  }

  const availableTopics = [
    (grant.organisationEligibility?.length || grant.eligibleCountries?.length) && "eligibility",
    (grant.fundingAmount || grant.fundingType) && "funding",
    grant.deadline && "the deadline",
    grant.whyItMatches && "why it was returned",
  ].filter(Boolean);
  return [
    {
      type: "text",
      text: availableTopics.length
        ? `From this grant's record, I can answer questions about ${availableTopics.join(", ")}.`
        : `This result includes a title and summary for ${grant.title}, but its source did not provide detailed eligibility, funding, deadline, or match fields.`,
    },
    {
      type: "text",
      text: "This is a local, rule-based answer using only the grant fields shown here—not a live AI response.",
    },
  ];
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

export function App() {
  const c = useConversations();
  const { synchronizeBackendMessages } = c;
  const apps = useApplications();
  const addApplication = apps.addApplication;
  const [busy, setBusy] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  // Which main view is showing. Local, non-persisted UI state: the pipeline
  // dashboard is global across conversations, so it's a sibling view of the
  // chat rather than a block inside one — the app still has a single route.
  const [mainView, setMainView] = useState<MainView>("chat");
  const [composerValue, setComposerValue] = useState("");
  const [askingAboutGrant, setAskingAboutGrant] = useState<Grant | null>(null);
  const [startingGrantId, setStartingGrantId] = useState<string | null>(null);
  const [backendConnection, setBackendConnection] = useState<BackendConnection>(
    isMockMode ? { status: "local" } : { status: "checking" },
  );
  const [backendHistorySync, setBackendHistorySync] = useState<BackendHistorySync>({
    status: "idle",
  });
  const researchInFlight = useRef(false);
  const historySyncRequest = useRef(0);
  const isMobile = useIsMobile();

  const handleSignOut = useCallback(() => {
    void logout();
  }, []);

  useEffect(() => {
    if (!backendService) {
      setBackendConnection({ status: "local" });
      return;
    }
    let cancelled = false;
    setBackendConnection({ status: "checking" });
    backendService
      .getInfo()
      .then((info) => {
        if (!cancelled) {
          setBackendConnection({
            status: "connected",
            appName: info.appName,
            version: info.version,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setBackendConnection({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const synchronizeBackendHistory = useCallback(
    async (conversationId: string, backendConversationId: string) => {
      if (!chatService) return;
      const requestId = ++historySyncRequest.current;
      setBackendHistorySync({ status: "syncing", conversationId });
      try {
        const messages = await chatService.getMessages(backendConversationId);
        if (historySyncRequest.current !== requestId) return;
        synchronizeBackendMessages(conversationId, messages);
        setBackendHistorySync({ status: "synced", conversationId });
      } catch (error) {
        if (historySyncRequest.current !== requestId) return;
        setBackendHistorySync({
          status: "error",
          conversationId,
          message:
            error instanceof Error
              ? error.message
              : "The backend conversation history could not be loaded.",
        });
      }
    },
    [synchronizeBackendMessages],
  );

  useEffect(() => {
    const conversationId = c.activeConversation?.id;
    const backendConversationId = c.activeConversation?.backendConversationId;
    if (!chatService || !conversationId || !backendConversationId) {
      historySyncRequest.current += 1;
      setBackendHistorySync({ status: "idle" });
      return;
    }
    void synchronizeBackendHistory(conversationId, backendConversationId);
  }, [
    c.activeConversation?.backendConversationId,
    c.activeConversation?.id,
    synchronizeBackendHistory,
  ]);

  const runResearch = useCallback(
    async (profile: OrganisationProfile) => {
      if (researchInFlight.current) return;
      researchInFlight.current = true;
      setBusy(true);
      c.setStage("researching");

      const researchSteps = isMockMode ? MOCK_RESEARCH_STEPS : LIVE_RESEARCH_STEPS;
      const state: ResearchState = {
        steps: researchSteps.map((label, i) => ({
          label,
          status: i === 0 ? ("active" as const) : ("pending" as const),
        })),
      };
      const messageId = askAssistant([{ type: "research_status", state }]);

      try {
        const handleProgress = (event: SseEvent) => {
          if (!event.stage) return;
          const stageIndexMap: Record<string, number> = {
            keywords: 0,
            search: 1,
            select: 2,
          };
          const activeIndex = stageIndexMap[event.stage] ?? 0;
          setBlocks(messageId, (blocks) =>
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
              return { type: "research_status", state: { steps } };
            }),
          );
        };

        const result = await grantService.searchGrants(profile, handleProgress);
        const grants = result.grants;
        setBlocks(messageId, (blocks) =>
          blocks.map((block) =>
            block.type === "research_status"
              ? {
                  type: "research_status",
                  state: {
                    steps: block.state.steps.map((step) => ({ ...step, status: "done" as const })),
                  },
                }
              : block,
          ),
        );
        c.setGrants(grants);
        c.setStage("results");
        askAssistant([
          {
            type: "text",
            text:
              grants.length === 0
                ? `I couldn't find any ${isMockMode ? "demo matches" : "live opportunities"} for ${profile.organisationName}. Here's what usually helps:`
                : isMockMode
                  ? `I found ${grants.length} demo matches for ${profile.organisationName}. Here are the strongest simulated results, ranked by fit:`
                  : `I found ${grants.length} live ${grants.length === 1 ? "opportunity" : "opportunities"} for ${profile.organisationName}. These results were ranked by the backend grant agent.`,
          },
          { type: "grant_results", grants, sourceSummary: result.sourceSummary },
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
          text: isMockMode
            ? "Thanks — that's enough to start. Let me research the best demo matches across European programmes."
            : "Thanks — that's enough to start. I’ll search the live Horizon opportunities available through the backend.",
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
      const facts = [
        grant.programme && `Programme: ${grant.programme}`,
        !grant.programme && grant.source && `Source: ${grant.source}`,
        grant.fundingAmount && `Funding: ${grant.fundingAmount}`,
        grant.fundingType && `Funding type: ${grant.fundingType}`,
        grant.deadline && `Deadline: ${grant.deadline}`,
      ].filter((fact): fact is string => Boolean(fact));
      const requirements = grant.requirements?.length
        ? `\n\nKey requirements:\n${grant.requirements.map((requirement) => `• ${requirement}`).join("\n")}`
        : "";
      askAssistant([
        {
          type: "text",
          text: `${grant.title}\n\n${grant.description}${facts.length ? `\n\n${facts.join("\n")}` : ""}${requirements}\n\nOpen the official source when available, or start a local application draft here.`,
        },
      ]);
    },
    [askAssistant, askUser],
  );

  const handleStartApplication = useCallback(
    async (grant: Grant) => {
      if (!c.activeConversation?.profile) return;
      setAskingAboutGrant(null);
      setStartingGrantId(grant.id);
      setBusy(true);
      const profile = c.activeConversation.profile;
      try {
        const currentDocument = c.activeConversation.document;
        let doc =
          currentDocument?.grantId === grant.id
            ? currentDocument
            : await applicationService.findSavedApplication(grant.id);
        const reopened = Boolean(doc);
        if (!doc) {
          const statusMessageId = askAssistant([
            {
              type: "text",
              text: `Drafting application for "${grant.title}"...\nAnalyzing requirements...`,
            },
          ]);
          const handleDraftProgress = (event: SseEvent) => {
            if (event.message && statusMessageId) {
              setBlocks(statusMessageId, () => [
                {
                  type: "text",
                  text: `Drafting application for "${grant.title}"...\n${event.message}`,
                },
              ]);
            }
          };
          doc = await applicationService.startApplication(grant, profile, handleDraftProgress);
        }
        c.setDocument(doc, grant.id);
        c.setStage("application");
        addApplication({
          id: doc.id,
          grantId: grant.id,
          grantTitle: grant.title,
          grantOrganisation: grant.programme ?? grant.source ?? "Unknown funder",
          applicantOrganisation: profile.organisationName || "Unknown applicant",
          status: "drafting",
          fundingAmount: grant.fundingAmount ?? profile.fundingAmount ?? "Not specified",
          deadline: grant.deadline ?? "",
          updatedAt: doc.updatedAt || new Date().toISOString(),
        });
        askAssistant([
          {
            type: "success",
            message: reopened
              ? `Saved application reopened for ${grant.title}. Continue editing, try a rewrite, or export it.`
              : `${isMockMode ? "Local" : "AI-generated"} application draft created and saved for ${grant.title}. Edit any section, try a rewrite, or export it.`,
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
        setStartingGrantId(null);
      }
    },
    [addApplication, askAssistant, c],
  );

  const handleOpenApplication = useCallback(
    async (applicationId: string) => {
      setBusy(true);
      try {
        const opened = await applicationService.getApplication(applicationId);
        if (opened.profile) c.setProfile(opened.profile);
        if (opened.grant) {
          const grants = c.activeConversation?.grants ?? [];
          c.setGrants(
            grants.some((grant) => grant.id === opened.grant?.id)
              ? grants
              : [opened.grant, ...grants],
          );
        }
        c.setDocument(opened.document, opened.document.grantId);
        c.setStage("application");
        setMainView("chat");
        askAssistant([
          {
            type: "success",
            message: `Saved application opened for ${opened.document.grantTitle}.`,
          },
          { type: "document", documentId: opened.document.id },
        ]);
      } catch (error) {
        setMainView("chat");
        askAssistant([
          {
            type: "error",
            message:
              error instanceof Error ? error.message : "The saved application could not be opened.",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [askAssistant, c],
  );

  const sendBackendChatMessage = useCallback(
    async (text: string, includeProfileForm = false) => {
      const activeConversation = c.activeConversation;
      if (!chatService || !activeConversation) return;
      setBusy(true);
      try {
        let backendConversationId = activeConversation.backendConversationId;
        if (!backendConversationId) {
          const backendConversation = await chatService.createConversation();
          backendConversationId = backendConversation.conversationId;
          c.setBackendConversationId(backendConversationId);
        }

        const reply = await chatService.sendMessage({
          conversationId: backendConversationId,
          sessionId: activeConversation.id,
          userMessage: text,
          profile: activeConversation.profile,
        });
        if (reply.conversationId !== backendConversationId) {
          c.setBackendConversationId(reply.conversationId);
        }
        const blocks = chatReplyBlocks(reply);
        if (includeProfileForm) blocks.push({ type: "structured_form" });
        askAssistant(blocks);
        void synchronizeBackendHistory(activeConversation.id, reply.conversationId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The backend chat request failed.";
        const blocks: ChatBlock[] = [{ type: "error", message }];
        if (includeProfileForm) {
          blocks.push({
            type: "text",
            text: "You can still complete the local profile form and run grant search directly.",
          });
          blocks.push({ type: "structured_form" });
        }
        askAssistant(blocks);
      } finally {
        setBusy(false);
      }
    },
    [askAssistant, c, synchronizeBackendHistory],
  );

  const handleUserSend = useCallback(
    (text: string) => {
      askUser([{ type: "text", text }]);
      const stage = c.activeConversation?.stage ?? "welcome";
      if (askingAboutGrant) {
        askAssistant(answerAboutGrant(text, askingAboutGrant));
      } else if (stage === "welcome") {
        c.setStage("collecting_information");
        if (chatService) {
          void sendBackendChatMessage(text, true);
        } else {
          askAssistant([
            {
              type: "text",
              text: "Great — to match you to the strongest calls, please complete this short profile.",
            },
            { type: "structured_form" },
          ]);
        }
      } else if (stage === "application") {
        askAssistant([
          {
            type: "text",
            text: "You can edit any section directly, try an AI rewrite, or export the whole document as PDF or Word.",
          },
        ]);
      } else if (chatService) {
        void sendBackendChatMessage(text);
      } else {
        askAssistant([
          {
            type: "text",
            text: "I've noted that. You can keep refining the draft, ask about any of the recommended grants, or start a new conversation for a different funding scenario.",
          },
        ]);
      }
    },
    [askAssistant, askUser, askingAboutGrant, c, sendBackendChatMessage],
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
      // TODO(api): once a grant-details endpoint exists, replace this fallback with
      // GET /grants/{id} — that will require getGrantById to become async
      // and the render path here to move to a loading-aware pattern; not
      // done now since it's a real behavioural change, not just a data-source swap.
      getGrantById: (id) =>
        c.activeConversation?.grants?.find((g) => g.id === id) ??
        MOCK_GRANTS.find((g) => g.id === id),
      formDisabled: busy,
      // "Has the search finished", not "did it find anything" — a completed
      // search that matched nothing must still stop the research card's
      // preparing-results skeletons, or they'd spin forever above the
      // no-matches state.
      hasGrantResults: c.activeConversation?.grants !== undefined,
      startingGrantId,
      existingGrantIds: new Set([
        ...apps.applications.map((a) => a.grantId),
        ...(c.activeConversation?.document?.grantId ? [c.activeConversation.document.grantId] : []),
      ]),
    }),
    [
      apps.applications,
      busy,
      c.activeConversation,
      c.updateDocumentSection,
      handleAskGrant,
      handleRetryResearch,
      handleStartApplication,
      handleSubmitProfile,
      startingGrantId,
    ],
  );

  const active = c.activeConversation;
  const connectionLabel =
    backendConnection.status === "local"
      ? "Connected · Mock mode"
      : backendConnection.status === "checking"
        ? "Checking backend… · API mode"
        : backendConnection.status === "connected"
          ? `Connected · Backend v${backendConnection.version}`
          : "Backend unavailable · API mode";
  const connectionDotClass =
    backendConnection.status === "connected" || backendConnection.status === "local"
      ? "bg-success"
      : backendConnection.status === "checking"
        ? "bg-warning"
        : "bg-destructive";
  const activeHistorySync =
    backendHistorySync.status !== "idle" && backendHistorySync.conversationId === active?.id
      ? backendHistorySync
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
    const draftingCoveringIndicator =
      last?.role === "assistant" &&
      lastBlock?.type === "text" &&
      lastBlock.text.startsWith("Drafting application");
    return !researchCoveringIndicator && !draftingCoveringIndicator;
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
    mainView === "pipeline" ? "Application pipeline" : (active?.title ?? "No conversation");

  return (
    <div className="h-dvh-safe flex w-full overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
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
        isMockMode={isMockMode}
        mainView={mainView}
        onSelectView={setMainView}
        onSignOut={handleSignOut}
        onOpenAccount={() => setAccountModalOpen(true)}
      />
      <MobileSidebar
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
        conversations={c.conversations}
        activeId={c.activeId}
        onSelect={selectConversationInChat}
        isMockMode={isMockMode}
        onNew={newConversationInChat}
        onRename={c.renameConversation}
        onDelete={c.deleteConversation}
        mainView={mainView}
        onSelectView={setMainView}
        onSignOut={handleSignOut}
        onOpenAccount={() => setAccountModalOpen(true)}
      />
      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        onSignOut={handleSignOut}
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
              {mainView === "chat" && active?.updatedAt && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(active.updatedAt), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isMockMode && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", connectionDotClass)} />
                {connectionLabel}
              </span>
            )}
            {isMockMode && mainView === "chat" && active?.stage === "welcome" && (
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
            <ThemeToggle />
          </div>
        </header>

        {activeHistorySync && (
          <div
            role="status"
            aria-live="polite"
            className="shrink-0 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground sm:px-6"
          >
            {activeHistorySync.status === "syncing" && "Syncing history…"}
            {activeHistorySync.status === "synced" && "History synced"}
            {activeHistorySync.status === "error" &&
              `History sync failed: ${activeHistorySync.message}`}
          </div>
        )}

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
                <WelcomeScreen
                  onQuickStart={handleUserSend}
                  onFillComposer={setComposerValue}
                  isMockMode={isMockMode}
                />
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
                  className="rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90"
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

        {mainView === "pipeline" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* The pipeline's empty state sends people back to the chat; it
                reuses this same view toggle rather than adding a route. */}
            <PipelineDashboard
              onGoToChat={() => setMainView("chat")}
              onOpenApplication={handleOpenApplication}
              applications={apps.applications}
              hydrated={apps.hydrated}
              persistenceOk={apps.persistenceOk}
              updateStatus={apps.updateStatus}
              isMockMode={isMockMode}
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
            isMockMode={isMockMode}
            grantContext={askingAboutGrant}
            onClearGrantContext={() => setAskingAboutGrant(null)}
          />
        </div>
      </main>
    </div>
  );
}
