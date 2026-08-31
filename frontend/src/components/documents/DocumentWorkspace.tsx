import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  FileDown,
  FileText,
  ListOrdered,
  MessagesSquare,
  Send,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import type {
  ApplicationDocument,
  DocumentSection as DocSection,
  Grant,
  OrganisationProfile,
} from "@/types";
import type { ApplicationStatus } from "@/data/mockApplications";
import { useProgressiveReveal } from "@/hooks/useProgressiveReveal";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { exportAsPdf, exportAsWord } from "@/utils/export";
import { STATUS_BADGE, STATUS_LABEL } from "@/components/pipeline/statusPresentation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { diffLines } from "@/utils/diffLines";
import { formatDeadline } from "@/utils/deadline";
import { wordCount } from "@/utils/text";
import { applicationService } from "@/services";
import { cn } from "@/lib/utils";
import { InlineNotice } from "@/components/common/InlineNotice";
import { EmptyState } from "@/components/EmptyState";

const WORD_BUDGET = 2500;

/**
 * Continuous Google-Docs style section — integrated smoothly into the continuous document flow.
 * Direct text modifications are handled autonomously by the AI agent via the Assistant Panel.
 */
function GoogleDocsSection({
  index,
  section,
  content,
  revealText,
  onRevealComplete,
}: {
  index: number;
  section: DocSection;
  content: string;
  onAskAssistant?: () => void;
  revealText?: string;
  onRevealComplete?: () => void;
  active?: boolean;
}) {
  const { revealed, streaming: revealing } = useProgressiveReveal(revealText, onRevealComplete);
  const displayText = revealed ?? content;
  const words = wordCount(displayText);

  return (
    <article
      id={`workspace-section-${section.id}`}
      aria-labelledby={`workspace-section-title-${section.id}`}
      className="scroll-mt-8 py-4 first:pt-0"
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <h2
          id={`workspace-section-title-${section.id}`}
          className="text-lg sm:text-xl font-bold text-foreground tracking-tight"
        >
          <span className="text-muted-foreground mr-2 font-medium">{index}.</span>
          <span>{section.title}</span>
        </h2>
        <span className="text-xs text-muted-foreground font-normal tabular-nums shrink-0">
          {words}w
        </span>
      </div>

      <div className="whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed sm:leading-[1.8] text-foreground/90 font-normal [overflow-wrap:anywhere]">
        {displayText}
        {revealing && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] bg-brand motion-safe:animate-pulse"
          />
        )}
      </div>
    </article>
  );
}

/**
 * The workspace's single header strip — full width, sitting directly below
 * the app's own header (see App.tsx) and styled to match it (same
 * border/blur/padding recipe), so the two read as one continuous header
 * region instead of two competing blocks. Deliberately does NOT repeat the
 * grant title: App's header already shows it as the page's `<h1>`, so
 * restating it here as a second, bigger heading is exactly the duplication
 * this bar exists to remove. Also deliberately has no theme control (the
 * app's own header carries the one, consistent toggle) and no Export
 * control (see `WorkspaceExportControl`, rendered by App.tsx next to that
 * same toggle) — kept down to a single glanceable status line so the
 * document's own header carries the least text possible: the honesty
 * badge, save state, and deadline. Word count and per-visit "Saved X ago"
 * are deliberately dropped here — they're still available per-section and
 * in the word-budget bar, so nothing is lost, just decluttered.
 */
function WorkspaceMetaBar({
  doc,
  grant,
  pipelineStatus,
  drafts,
}: {
  doc: ApplicationDocument;
  grant: Grant | undefined;
  pipelineStatus: ApplicationStatus | undefined;
  drafts: Record<string, string>;
}) {
  const savedContentOf = (id: string) => doc.sections.find((s) => s.id === id)?.content ?? "";
  const dirtyCount = doc.sections.filter((s) => {
    const draft = drafts[s.id];
    return draft !== undefined && draft !== savedContentOf(s.id);
  }).length;

  return (
    <div className="shrink-0 border-b border-border bg-background/80 px-3 py-3 backdrop-blur sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        {pipelineStatus && (
          <Badge
            variant="outline"
            className={cn("shrink-0 whitespace-nowrap font-medium", STATUS_BADGE[pipelineStatus])}
          >
            <span className="sr-only">Pipeline status: </span>
            {STATUS_LABEL[pipelineStatus]}
          </Badge>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-medium",
            dirtyCount > 0 ? "text-warning" : "text-success",
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", dirtyCount > 0 ? "bg-warning" : "bg-success")}
          />
          {dirtyCount > 0
            ? `Unsaved changes in ${dirtyCount} section${dirtyCount === 1 ? "" : "s"}`
            : "All changes saved"}
        </span>
        {grant?.deadline && <span>Deadline {formatDeadline(grant.deadline)}</span>}
      </div>
    </div>
  );
}

/**
 * The document's Export control, rendered by App.tsx in its own top header
 * (immediately before the theme toggle) rather than inside the workspace's
 * own header strip — grouping the two "global corner" controls together.
 * Self-contained: owns its own error state and renders its failure notice
 * as a small popover anchored to the button, since it now lives in a slim
 * app-wide header bar with no room for a full-width inline notice.
 */
export function WorkspaceExportControl({ doc }: { doc: ApplicationDocument }) {
  const [exportError, setExportError] = useState<"pdf" | "word" | null>(null);

  const handleExportPdf = () => setExportError(exportAsPdf(doc) ? null : "pdf");
  const handleExportWord = async () => {
    const ok = await exportAsWord(doc);
    setExportError(ok ? null : "word");
  };
  const retry = exportError === "pdf" ? handleExportPdf : handleExportWord;

  return (
    <div className="relative shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="rounded-lg hover:bg-muted">
            <FileDown className="h-3.5 w-3.5" />
            Export
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExportPdf}>
            <FileDown className="h-3.5 w-3.5" />
            Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportWord}>
            <FileDown className="h-3.5 w-3.5" />
            Export as Word
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {exportError && (
        <div
          role="alert"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-destructive/30 bg-card p-3 text-xs text-destructive shadow-lg"
        >
          <p>
            {exportError === "pdf"
              ? "Couldn't open the PDF preview — your browser may have blocked the pop-up window."
              : "Couldn't create the Word file — your browser may have blocked the download."}{" "}
            Allow pop-ups or downloads for this site, then try again.
          </p>
          <div className="mt-2 flex justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExportError(null)}
              className="h-auto rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Dismiss
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retry}
              className="h-auto rounded-md border-destructive/40 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
            >
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceEditor({
  doc,
  profile,
  grant,
  streamingSections,
  onRevealComplete,
  totalWords,
  showAssistant,
  onToggleAssistant,
}: {
  doc: ApplicationDocument;
  profile: OrganisationProfile | undefined;
  grant: Grant | undefined;
  /** sectionId -> the full text an AI rewrite just produced for it, purely
   * for the progressive-reveal effect (see GoogleDocsSection). */
  streamingSections: Record<string, string>;
  onRevealComplete: (id: string) => void;
  totalWords: number;
  showAssistant: boolean;
  onToggleAssistant: (show: boolean) => void;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    doc.sections[0]?.id ?? null,
  );
  const [showOutline, setShowOutline] = useState(false);

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    document
      .getElementById(`workspace-section-${id}`)
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-muted/20">
      {/* Left Outline Sidebar (Google Docs Style) */}
      {showOutline && (
        <aside
          aria-label="Document outline"
          className="flex w-64 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-sm transition-all duration-200"
        >
          <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-brand" />
              <span className="text-xs font-semibold text-foreground">Document Outline</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowOutline(false)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              title="Hide outline"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <nav aria-label="Section navigation" className="flex-1 overflow-y-auto p-3 space-y-1">
            {doc.sections.map((s, i) => {
              const active = s.id === activeSectionId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                    active
                      ? "bg-brand/10 font-medium text-brand"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div className="min-w-0 flex-1 leading-snug">
                    <span className="font-semibold mr-1.5 tabular-nums">{i + 1}.</span>
                    <span>{s.title}</span>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground/80 tabular-nums">
                    {wordCount(s.content)}w
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-border/80 px-4 py-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>{doc.sections.length} sections</span>
            <span>{totalWords} / {WORD_BUDGET} words</span>
          </div>
        </aside>
      )}

      {/* Main Document Paper Scroll Area */}
      <section aria-label="Document editor" className="relative min-h-0 flex-1 overflow-y-auto">
        {/* Floating Quick Action Controls (Stays pinned when scrolling) */}
        {(!showOutline || !showAssistant) && (
          <div className="pointer-events-none sticky top-3 z-30 flex items-center justify-between px-4 sm:px-8 mb-2">
            <div className="pointer-events-auto">
              {!showOutline && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOutline(true)}
                  className="h-8 gap-2 rounded-full border-border bg-card/95 px-3.5 text-xs font-medium text-foreground shadow-md backdrop-blur-md hover:border-brand/40 hover:bg-card transition-all"
                >
                  <ListOrdered className="h-3.5 w-3.5 text-brand" />
                  <span>Document Outline ({doc.sections.length})</span>
                </Button>
              )}
            </div>

            <div className="pointer-events-auto">
              {!showAssistant && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleAssistant(true)}
                  className="h-8 gap-2 rounded-full border-brand/30 bg-card/95 px-3.5 text-xs font-medium text-brand shadow-md backdrop-blur-md hover:border-brand/60 hover:bg-brand/5 transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5 text-brand" />
                  <span>Open Assistant</span>
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-8 lg:px-10 pb-16">
          {/* Continuous Google Docs "Paper" Sheet */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-12 md:p-16 shadow-lg ring-1 ring-border/30">
          {/* Document Cover / Header */}
          <header className="border-b border-border/70 pb-8 mb-8">
            <div className="mb-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
                {doc.programme || grant?.programme || "European Grant Proposal"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight">
              {doc.grantTitle}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>
                <strong>Applicant:</strong> {profile?.organisationName || "Applicant Organisation"}
              </span>
              {grant?.fundingAmount && (
                <span>
                  <strong>Funding:</strong> {grant.fundingAmount}
                </span>
              )}
              {grant?.deadline && (
                <span>
                  <strong>Deadline:</strong> {formatDeadline(grant.deadline)}
                </span>
              )}
            </div>
          </header>

          {/* Continuous Flow of All Sections */}
          <div className="space-y-8">
            {doc.sections.map((section, i) => (
              <GoogleDocsSection
                key={section.id}
                index={i + 1}
                section={section}
                content={section.content}
                revealText={streamingSections[section.id]}
                onRevealComplete={() => onRevealComplete(section.id)}
              />
            ))}
          </div>

          {/* Document Footer */}
          <footer className="mt-12 pt-6 border-t border-border/70 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Total Length:{" "}
              <span className="font-semibold text-foreground tabular-nums">{totalWords}</span> /{" "}
              {WORD_BUDGET} words
            </div>
          </footer>
        </div>
      </div>
    </section>
  </div>
);
}

interface TextMessage {
  id: string;
  kind: "text";
  role: "user" | "assistant";
  text: string;
  tone?: "error";
}

interface ProposedEdit {
  sectionId: string;
  sectionTitle: string;
  previousText: string;
  newText: string;
  status: "pending" | "applied" | "discarded";
}

interface ProposalMessage {
  id: string;
  kind: "proposal";
  proposal: ProposedEdit;
}

type WorkspaceChatMessage = TextMessage | ProposalMessage;

interface AiEdit {
  sectionId: string;
  previousText: string;
}

/**
 * One chat bubble. Assistant confirmations (not errors — bad news shouldn't
 * be paced out) get the same word-by-word reveal as the document text, so
 * the panel reads as live too. `useProgressiveReveal` only restarts when
 * its `text` argument changes, and this message's `text` is fixed for the
 * lifetime of this component instance, so it plays once on mount and never
 * replays on unrelated re-renders.
 */
function MessageBubble({ message }: { message: TextMessage }) {
  const shouldReveal = message.role === "assistant" && message.tone !== "error";
  const { revealed, streaming } = useProgressiveReveal(shouldReveal ? message.text : undefined);
  const displayText = shouldReveal ? (revealed ?? "") : message.text;

  return (
    <div
      className={cn(
        "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]",
        message.role === "user" && "bg-muted text-foreground",
        message.role === "assistant" &&
          message.tone !== "error" &&
          "border border-border bg-muted/30 text-foreground",
        message.tone === "error" &&
          "border border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {displayText}
      {streaming && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] bg-brand motion-safe:animate-pulse dark:bg-foreground"
        />
      )}
    </div>
  );
}

/**
 * The card shown in Review mode instead of applying immediately — a
 * line-level diff (see utils/diffLines) between what's currently saved and
 * what the mock produced, plus Apply/Discard. Nothing about the document
 * changes until Apply is clicked; Discard just marks this card resolved.
 */
function ProposedEditCard({
  proposal,
  disabled,
  onApply,
  onDiscard,
}: {
  proposal: ProposedEdit;
  disabled: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const [showFullDiff, setShowFullDiff] = useState(false);
  const diff = useMemo(
    () => diffLines(proposal.previousText, proposal.newText),
    [proposal.previousText, proposal.newText],
  );
  const hasChanges = diff.some((line) => line.type !== "same");
  const visibleLines = showFullDiff ? diff : diff.filter((line) => line.type !== "same");
  const wordDelta = wordCount(proposal.newText) - wordCount(proposal.previousText);

  return (
    <div className="w-full max-w-[92%] rounded-2xl border border-border bg-card p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0 truncate">Proposed edit — {proposal.sectionTitle}</span>
        </div>
        <span
          className={cn(
            "shrink-0 text-xs font-medium tabular-nums",
            wordDelta > 0 && "text-success",
            wordDelta < 0 && "text-destructive",
            wordDelta === 0 && "text-muted-foreground",
          )}
        >
          {wordDelta > 0 ? `+${wordDelta}` : wordDelta} words
        </span>
      </div>

      {proposal.status === "pending" ? (
        <>
          <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
            {!hasChanges ? (
              <p className="text-muted-foreground">No line-level changes to show.</p>
            ) : (
              visibleLines.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "whitespace-pre-wrap break-words rounded px-1 [overflow-wrap:anywhere]",
                    line.type === "removed" && "bg-destructive/10 text-destructive line-through",
                    line.type === "added" && "bg-success/10 text-success",
                    line.type === "same" && "text-muted-foreground",
                  )}
                >
                  <span aria-hidden="true">
                    {line.type === "removed" ? "− " : line.type === "added" ? "+ " : "  "}
                  </span>
                  <span className="sr-only">
                    {line.type === "removed"
                      ? "Removed: "
                      : line.type === "added"
                        ? "Added: "
                        : "Unchanged: "}
                  </span>
                  {line.text || " "}
                </div>
              ))
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {hasChanges ? (
              <button
                type="button"
                onClick={() => setShowFullDiff((v) => !v)}
                className="text-[11px] font-medium text-brand hover:underline"
              >
                {showFullDiff ? "Show changes only" : "Full diff"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDiscard}
                disabled={disabled}
                className="h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onApply}
                disabled={disabled}
                className="h-auto rounded-md bg-brand px-2 py-1 text-[11px] font-medium text-brand-foreground hover:bg-brand/90"
              >
                Apply
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p
          className={cn(
            "mt-2 flex items-center gap-1.5 text-xs font-medium",
            proposal.status === "applied" ? "text-success" : "text-muted-foreground",
          )}
        >
          {proposal.status === "applied" ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Applied to the document.
            </>
          ) : (
            "Discarded — no changes made."
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Which section(s) an instruction is talking about — keyword matching
 * against each section's own title, mirroring how answerAboutGrant and
 * openingAcknowledgement in App.tsx read intent (lowercase, a handful of
 * hand-picked regexes, never a real intent model). Deliberately keyed by
 * section id rather than derived generically from title words: two titles
 * ("Organisation Overview", "Budget Overview") share "overview", and a
 * generic word-overlap matcher would treat that shared word as a hit for
 * both — exactly the wrong-guess this is supposed to avoid. Each pattern
 * below is chosen to be specific to ONE section.
 */
const SECTION_KEYWORDS: Record<string, RegExp> = {
  "organisation-overview": /organi[sz]ation overview|about (the |our )?organi[sz]ation|who we are/,
  "project-summary": /project summary|\bsummary\b/,
  "problem-statement": /problem statement|\bproblem\b/,
  "proposed-solution": /proposed solution|\bsolution\b/,
  innovation: /\binnovat/,
  objectives: /\bobjectives?\b|\bgoals?\b/,
  "expected-impact": /expected impact|\bimpact\b/,
  sustainability: /\bsustainab/,
  "implementation-plan": /implementation plan|\bimplementation\b/,
  timeline: /\btimeline\b|\bschedule\b/,
  "budget-overview": /budget overview|\bbudget\b/,
  "risk-management": /risk management|\brisks?\b/,
};

const WHOLE_DOCUMENT_PATTERN =
  /whole document|entire document|everything|all sections|every section|the whole thing/;

type SectionTarget =
  { kind: "all" } | { kind: "sections"; sections: DocSection[] } | { kind: "none" };

/**
 * `pinnedSectionId` (set via a section's "Ask assistant" button) is only a
 * FALLBACK: an instruction that explicitly names a section — including a
 * different one — still wins, since typed words are more specific than an
 * earlier click. The pin exists to resolve what would otherwise be an
 * ambiguous instruction, not to override a clear one.
 */
function matchTargetSections(
  instruction: string,
  sections: DocSection[],
  pinnedSectionId: string | null,
): SectionTarget {
  const q = instruction.toLowerCase();
  if (WHOLE_DOCUMENT_PATTERN.test(q)) return { kind: "all" };

  const matched = sections.filter((s) => SECTION_KEYWORDS[s.id]?.test(q));
  if (matched.length > 0) return { kind: "sections", sections: matched };

  if (pinnedSectionId) {
    const pinned = sections.find((s) => s.id === pinnedSectionId);
    if (pinned) return { kind: "sections", sections: [pinned] };
  }

  return { kind: "none" };
}

type ApplyMode = "review" | "auto";

/**
 * The working side chat: instruction in, section (or whole document)
 * rewritten out, via the SAME mock service the chat card's "Rewrite (mock
 * AI)" button already calls. Message history is local component state —
 * intentionally not persisted (see the round's brief).
 *
 * Review mode (default) proposes a change and waits for Apply; Auto-apply
 * commits immediately — but both funnel through the exact same
 * `onApplyRewrite` prop (commit + streaming reveal), so the save path never
 * forks in two.
 */
function AssistantPanel({
  doc,
  profile,
  grant,
  drafts,
  pinnedSectionId,
  onClearPinnedSection,
  onApplyRewrite,
  onClose,
}: {
  doc: ApplicationDocument;
  profile: OrganisationProfile | undefined;
  grant: Grant | undefined;
  /** Read-only here — used so an instruction rewrites whatever the user is
   * currently looking at, including an in-progress unsaved edit, matching
   * how the chat card's own Rewrite button already behaves. */
  drafts: Record<string, string>;
  pinnedSectionId: string | null;
  onClearPinnedSection: () => void;
  onApplyRewrite: (sectionId: string, text: string) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<ApplyMode>("review");
  const [progress, setProgress] = useState<{ index: number; total: number; title: string } | null>(
    null,
  );
  const [lastEdit, setLastEdit] = useState<AiEdit[] | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const nextIdRef = useRef(0);
  const inputId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pinnedSection = pinnedSectionId
    ? doc.sections.find((s) => s.id === pinnedSectionId)
    : undefined;
  const pinnedIndex = pinnedSection ? doc.sections.indexOf(pinnedSection) : -1;

  // A section's "Ask assistant" button both pins the context chip and moves
  // focus here — this effect is the "moves focus" half of that.
  useEffect(() => {
    if (pinnedSectionId) textareaRef.current?.focus();
  }, [pinnedSectionId]);

  const nextId = () => {
    nextIdRef.current += 1;
    return `workspace-chat-${nextIdRef.current}`;
  };

  const pushMessage = useCallback((role: "user" | "assistant", text: string, tone?: "error") => {
    setMessages((prev) => [...prev, { id: nextId(), kind: "text", role, text, tone }]);
    if (role === "assistant") setAnnouncement(text);
  }, []);

  const pushProposal = useCallback((proposal: ProposedEdit) => {
    setMessages((prev) => [...prev, { id: nextId(), kind: "proposal", proposal }]);
    setAnnouncement(`Proposed an edit to "${proposal.sectionTitle}" — review it below.`);
  }, []);

  const currentTextOf = (sectionId: string) =>
    drafts[sectionId] ?? doc.sections.find((s) => s.id === sectionId)?.content ?? "";

  /** Auto-apply path: commits immediately. Returns the previous text on success, for the batch undo record. */
  const runRewrite = async (
    section: DocSection,
    instruction: string,
  ): Promise<{ ok: true; previousText: string } | { ok: false }> => {
    const previousText = currentTextOf(section.id);
    try {
      // profile is guaranteed by the caller (send is disabled without one).
      const next = await applicationService.rewriteSection(
        section.title,
        previousText,
        profile as OrganisationProfile,
        grant,
        doc.id,
        undefined,
        instruction,
      );
      onApplyRewrite(section.id, next);
      return { ok: true, previousText };
    } catch (err) {
      pushMessage(
        "assistant",
        err instanceof Error ? err.message : `The rewrite for "${section.title}" didn't finish.`,
        "error",
      );
      return { ok: false };
    }
  };

  /** Review path: same call, but pushes a pending proposal instead of committing. */
  const proposeRewrite = async (section: DocSection, instruction: string): Promise<boolean> => {
    const previousText = currentTextOf(section.id);
    try {
      const next = await applicationService.rewriteSection(
        section.title,
        previousText,
        profile as OrganisationProfile,
        grant,
        doc.id,
        undefined,
        instruction,
      );
      pushProposal({
        sectionId: section.id,
        sectionTitle: section.title,
        previousText,
        newText: next,
        status: "pending",
      });
      return true;
    } catch (err) {
      pushMessage(
        "assistant",
        err instanceof Error ? err.message : `The rewrite for "${section.title}" didn't finish.`,
        "error",
      );
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const instruction = value.trim();
    if (!instruction || pending || !profile) return;
    setValue("");
    pushMessage("user", instruction);

    const target = matchTargetSections(instruction, doc.sections, pinnedSectionId);
    // The pin is consumed by this attempt either way — a resolved pin has
    // done its job, and a stale one shouldn't silently keep influencing
    // later, unrelated messages.
    if (pinnedSectionId) onClearPinnedSection();

    if (target.kind === "none") {
      // Honest, not a guess: never falls back to "just edit section 1".
      pushMessage(
        "assistant",
        'Which section should I change? For example: "make the project summary more concise".',
      );
      return;
    }
    const targetSections = target.kind === "all" ? doc.sections : target.sections;

    setPending(true);
    setLastEdit(null);
    const showProgress = targetSections.length > 1;

    if (mode === "auto") {
      // Exactly today's behaviour: commit immediately, one grouped
      // confirmation and one grouped undo record for the whole submission.
      const edits: AiEdit[] = [];
      for (let i = 0; i < targetSections.length; i++) {
        const section = targetSections[i];
        if (showProgress) {
          setProgress({ index: i + 1, total: targetSections.length, title: section.title });
        }
        const result = await runRewrite(section, instruction);
        if (!result.ok) break;
        edits.push({ sectionId: section.id, previousText: result.previousText });
      }
      setProgress(null);

      if (edits.length > 0) {
        setLastEdit(edits);
        const editedTitles = targetSections.slice(0, edits.length).map((s) => s.title);
        let confirmation: string;
        if (edits.length === 1) {
          confirmation = `Updated "${editedTitles[0]}".`;
        } else if (edits.length < targetSections.length) {
          confirmation = `Updated ${edits.length} of ${targetSections.length} sections before stopping — the rest are unchanged.`;
        } else if (target.kind === "all") {
          // "Whole document" — naming all 12 sections would be a wall of
          // text; the count already says everything that matters.
          confirmation = `Applied your instruction to all ${edits.length} sections.`;
        } else {
          confirmation = `Updated ${edits.length} sections: ${editedTitles.map((t) => `"${t}"`).join(", ")}.`;
        }
        pushMessage("assistant", confirmation);
      }
    } else {
      // Review mode: one proposal card per targeted section. Nothing is
      // committed until the user clicks Apply on that specific card.
      for (let i = 0; i < targetSections.length; i++) {
        const section = targetSections[i];
        if (showProgress) {
          setProgress({ index: i + 1, total: targetSections.length, title: section.title });
        }
        const ok = await proposeRewrite(section, instruction);
        if (!ok) break;
      }
      setProgress(null);
    }

    setPending(false);
  };

  const handleUndo = () => {
    if (!lastEdit) return;
    for (const edit of lastEdit) {
      onApplyRewrite(edit.sectionId, edit.previousText);
    }
    const label =
      lastEdit.length === 1
        ? `"${doc.sections.find((s) => s.id === lastEdit[0].sectionId)?.title ?? "that section"}"`
        : `${lastEdit.length} sections`;
    pushMessage("assistant", `Reverted ${label} to the text before that change.`);
    setLastEdit(null);
  };

  const handleApplyProposal = (messageId: string, proposal: ProposedEdit) => {
    onApplyRewrite(proposal.sectionId, proposal.newText);
    setLastEdit([{ sectionId: proposal.sectionId, previousText: proposal.previousText }]);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.kind === "proposal"
          ? { ...m, proposal: { ...m.proposal, status: "applied" } }
          : m,
      ),
    );
    setAnnouncement(`Applied the proposed edit to "${proposal.sectionTitle}".`);
  };

  const handleDiscardProposal = (messageId: string, proposal: ProposedEdit) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.kind === "proposal"
          ? { ...m, proposal: { ...m.proposal, status: "discarded" } }
          : m,
      ),
    );
    setAnnouncement(`Discarded the proposed edit to "${proposal.sectionTitle}".`);
  };

  return (
    <aside
      aria-label="Assistant chat"
      className="flex min-h-0 w-full shrink-0 flex-col border-t border-border lg:w-[380px] lg:border-l lg:border-t-0"
    >
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              aria-label="Apply mode"
              className="inline-flex shrink-0 rounded-lg border border-border p-0.5 text-[11px] font-medium"
            >
              <button
                type="button"
                role="radio"
                aria-checked={mode === "review"}
                onClick={() => setMode("review")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  mode === "review"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Review
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "auto"}
                onClick={() => setMode("auto")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  mode === "auto"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Auto-apply
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
              title="Hide assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {mode === "review"
            ? "Proposes a change first — review the diff, then Apply or Discard."
            : "Applies a change straight to the document as soon as it's ready."}
        </p>
      </header>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
        {messages.length === 0 && !pending ? (
          <div className="m-auto max-w-[220px] text-center">
            <MessagesSquare
              className="mx-auto h-8 w-8 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Ask the assistant to revise your document.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              e.g. &ldquo;make the project summary more concise&rdquo; or &ldquo;rewrite everything
              more formally&rdquo;.
            </p>
          </div>
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {messages.map((m) =>
              m.kind === "text" ? (
                <li
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <MessageBubble message={m} />
                </li>
              ) : (
                <li key={m.id} className="flex justify-start">
                  <ProposedEditCard
                    proposal={m.proposal}
                    disabled={pending}
                    onApply={() => handleApplyProposal(m.id, m.proposal)}
                    onDiscard={() => handleDiscardProposal(m.id, m.proposal)}
                  />
                </li>
              ),
            )}
            {pending && (
              <li aria-hidden="true" className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/30 px-3.5 py-2.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" />
                  <span className="text-xs text-muted-foreground">
                    {progress
                      ? `Rewriting ${progress.index} of ${progress.total} — ${progress.title}…`
                      : "Rewriting…"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 motion-safe:animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 motion-safe:animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 motion-safe:animate-bounce rounded-full bg-muted-foreground/50" />
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

      {lastEdit && !pending && (
        <div className="shrink-0 border-t border-border px-4 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUndo}
            className="h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
          >
            <Undo2 className="h-3 w-3" />
            Undo last change
          </Button>
        </div>
      )}

      {!profile && (
        <div className="shrink-0 border-t border-border px-4 py-2.5">
          <InlineNotice tone="warning">
            No organisation profile is attached to this conversation, so the assistant can&apos;t
            rewrite anything yet.
          </InlineNotice>
        </div>
      )}

      <div className="shrink-0 border-t border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium uppercase tracking-wider">Context</span>
          {pinnedSection ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 font-medium text-brand">
              {pinnedIndex + 1}. {pinnedSection.title}
              <button
                type="button"
                onClick={onClearPinnedSection}
                aria-label={`Remove ${pinnedSection.title} from context`}
                className="rounded-full hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <span className="rounded-full border border-border px-2 py-0.5">Whole document</span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            Message the assistant
          </label>
          <Textarea
            id={inputId}
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
            disabled={pending || !profile}
            rows={2}
            placeholder="Ask the assistant to revise your document…"
            className="min-h-0 resize-none rounded-lg text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={pending || !profile || !value.trim()}
            aria-label="Send"
            className="shrink-0 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </aside>
  );
}

function DocumentWorkspaceContent({
  doc,
  profile,
  grant,
  pipelineStatus,
  onSectionChange,
}: {
  doc: ApplicationDocument;
  profile: OrganisationProfile | undefined;
  grant: Grant | undefined;
  pipelineStatus: ApplicationStatus | undefined;
  onSectionChange: (sectionId: string, content: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [streamingSections, setStreamingSections] = useState<Record<string, string>>({});
  const [pinnedSectionId, setPinnedSectionId] = useState<string | null>(null);

  const applyAiRewrite = (id: string, text: string) => {
    onSectionChange(id, text);
    setDrafts((prev) => ({ ...prev, [id]: text }));
    setStreamingSections((prev) => ({ ...prev, [id]: text }));
  };

  const clearStreaming = (id: string) => {
    setStreamingSections((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const totalWords = useMemo(
    () => doc.sections.reduce((sum, s) => sum + wordCount(drafts[s.id] ?? s.content), 0),
    [doc.sections, drafts],
  );

  const [showAssistant, setShowAssistant] = useState(true);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkspaceMetaBar doc={doc} grant={grant} pipelineStatus={pipelineStatus} drafts={drafts} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <WorkspaceEditor
          doc={doc}
          profile={profile}
          grant={grant}
          streamingSections={streamingSections}
          onRevealComplete={clearStreaming}
          totalWords={totalWords}
          showAssistant={showAssistant}
          onToggleAssistant={setShowAssistant}
        />
        {showAssistant && (
          <AssistantPanel
            doc={doc}
            profile={profile}
            grant={grant}
            drafts={drafts}
            pinnedSectionId={pinnedSectionId}
            onClearPinnedSection={() => setPinnedSectionId(null)}
            onApplyRewrite={applyAiRewrite}
            onClose={() => setShowAssistant(false)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Full-page document editor with a side chat panel — Cursor / Google-Docs
 * style, as a sibling main view of chat/pipeline/saved (see App.tsx's
 * `mainView`), not a route and not a ChatBlock.
 *
 * Always operates on the ACTIVE conversation's document — there is no
 * cross-conversation document registry in this app (see getDocument in
 * BlockRenderer), so "open the workspace for an application" means "switch
 * to that application's conversation, then switch mainView to workspace".
 */
export function DocumentWorkspace({
  doc,
  profile,
  grant,
  pipelineStatus,
  onSectionChange,
  onGoToChat,
}: {
  doc: ApplicationDocument | undefined;
  profile: OrganisationProfile | undefined;
  grant: Grant | undefined;
  /** Read-only pipeline status for the header pill; undefined when no matching row exists. */
  pipelineStatus?: ApplicationStatus | undefined;
  onSectionChange: (sectionId: string, content: string) => void;
  onGoToChat: () => void;
}) {
  const goToChat = useCallback(() => onGoToChat(), [onGoToChat]);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-14">
        <EmptyState
          headingLevel="h2"
          icon={FileText}
          title="No application open"
          description="Start an application from a grant in the chat, then open its workspace from here for a full-page, document-first view."
          action={{ label: "Find grants in chat", onClick: goToChat, icon: MessagesSquare }}
        />
      </div>
    );
  }

  return (
    <DocumentWorkspaceContent
      doc={doc}
      profile={profile}
      grant={grant}
      pipelineStatus={pipelineStatus}
      onSectionChange={onSectionChange}
    />
  );
}
