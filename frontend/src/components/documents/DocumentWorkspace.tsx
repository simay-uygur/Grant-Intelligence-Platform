import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileDown,
  FileText,
  MessagesSquare,
  Pencil,
  Send,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type {
  ApplicationDocument,
  Conversation,
  DocumentSection as DocSection,
  Grant,
  OrganisationProfile,
} from "@/types";
import { useDrafts } from "@/hooks/useDrafts";
import { useProgressiveReveal } from "@/hooks/useProgressiveReveal";
import { applicationService, isMockMode } from "@/services";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineNotice } from "@/components/common/InlineNotice";
import { DemoBadge } from "@/components/common/DemoBadge";
import { EmptyState } from "@/components/EmptyState";
import { wordCount, stripLeadingNumber } from "@/utils/text";
import { exportAsPdf, exportAsWord } from "@/utils/export";

/**
 * One section, always visible (not one-at-a-time like the chat's document
 * card) — the Google-Docs feel this view is going for. Manual edit/save/
 * cancel mirrors ApplicationDocumentView's SectionEditor exactly: presence
 * of a key in `drafts` means "in edit mode", Save commits via
 * `onSectionChange`, Cancel discards. Deliberately does NOT include
 * Rewrite-with-AI's OWN button, Undo, export, or the pipeline-status
 * control — those stay on the chat's document card; AI rewriting here comes
 * from the side chat instead (see AssistantPanel).
 *
 * Also carries the AI's targeting checkbox: any combination of sections can
 * be checked (not just one), replacing an earlier click-the-title
 * single-select that made it unclear which section an instruction would hit.
 */
function WorkspaceSection({
  index,
  section,
  draft,
  dirty,
  savedFlash,
  selected,
  onToggleSelect,
  onStartEdit,
  onChangeDraft,
  onCancel,
  onSave,
  revealText,
  onRevealComplete,
}: {
  index: number;
  section: DocSection;
  draft: string | undefined;
  dirty: boolean;
  savedFlash: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onStartEdit: () => void;
  onChangeDraft: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  /** Set only while an AI rewrite just landed on this section — the commit
   * already happened; this is purely how it's REVEALED on the way there. */
  revealText?: string;
  onRevealComplete?: () => void;
}) {
  const editing = draft !== undefined;
  const { revealed, streaming: revealing } = useProgressiveReveal(revealText, onRevealComplete);
  const displayText = editing ? draft : (revealed ?? section.content);
  const checkboxId = `workspace-select-${section.id}`;

  return (
    <section
      aria-labelledby={`workspace-section-${section.id}`}
      className={cn(
        "scroll-mt-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors",
        selected && "border-brand/40 bg-brand/5",
      )}
    >
      <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <Checkbox
            id={checkboxId}
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${stripLeadingNumber(section.title)} for AI editing`}
            className="mt-1 shrink-0"
          />
          <div className="min-w-0">
            <label htmlFor={checkboxId} className="cursor-pointer">
              <h3
                id={`workspace-section-${section.id}`}
                className="break-words text-base font-semibold text-foreground"
              >
                {index}. {stripLeadingNumber(section.title)}
              </h3>
            </label>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>{wordCount(displayText)} words</span>
              {selected && (
                <span className="inline-flex items-center gap-1 font-medium text-brand">
                  <Sparkles className="h-3 w-3" />
                  Targeted by AI
                </span>
              )}
              {revealing && (
                <span className="inline-flex items-center gap-1 font-medium text-brand motion-safe:animate-pulse">
                  <Sparkles className="h-3 w-3" />
                  Applying AI revision…
                </span>
              )}
              {dirty && <span className="font-medium text-warning">Unsaved changes</span>}
              {savedFlash && (
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <Check className="h-3 w-3" />
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStartEdit}
              className="h-auto rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="h-auto rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={!dirty}
                className="h-auto rounded-md bg-brand px-2 py-1 text-[11px] font-medium text-white hover:bg-brand/90 disabled:bg-muted disabled:text-muted-foreground"
              >
                <Check className="h-3 w-3" />
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => onChangeDraft(e.target.value)}
          rows={10}
          className="min-h-[220px] w-full resize-y break-words rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none [overflow-wrap:anywhere] focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85 [overflow-wrap:anywhere]">
          {displayText}
        </p>
      )}
    </section>
  );
}

function WorkspaceEditor({
  doc,
  drafts,
  savedFlashId,
  restoredIds,
  conflictIds,
  restoreDismissed,
  persistenceOk,
  selectedSectionIds,
  onToggleSection,
  onDismissRestore,
  onStartEdit,
  onChangeDraft,
  onCancel,
  onSave,
  streamingSections,
  onRevealComplete,
  onBackToHub,
  hasMultipleProposals,
  onGoToChat,
}: {
  doc: ApplicationDocument;
  drafts: Record<string, string>;
  savedFlashId: string | null;
  restoredIds: string[];
  conflictIds: string[];
  restoreDismissed: boolean;
  persistenceOk: boolean;
  selectedSectionIds: Set<string>;
  onToggleSection: (id: string) => void;
  onDismissRestore: () => void;
  onStartEdit: (id: string) => void;
  onChangeDraft: (id: string, value: string) => void;
  onCancel: (id: string) => void;
  onSave: (id: string) => void;
  streamingSections: Record<string, string>;
  onRevealComplete: (id: string) => void;
  onBackToHub?: () => void;
  hasMultipleProposals?: boolean;
  onGoToChat?: () => void;
}) {
  const savedContentOf = (id: string) => doc.sections.find((s) => s.id === id)?.content ?? "";
  const isDirty = (id: string) => {
    const draft = drafts[id];
    return draft !== undefined && draft !== savedContentOf(id);
  };
  const dirtyCount = doc.sections.filter((s) => isDirty(s.id)).length;
  const totalWords = doc.sections.reduce((sum, s) => {
    const text = drafts[s.id] ?? s.content;
    return sum + wordCount(text);
  }, 0);

  const titleOf = (id: string) => doc.sections.find((s) => s.id === id)?.title ?? "a section";
  const restoredSummary =
    restoredIds.length === 1
      ? `"${titleOf(restoredIds[0])}"`
      : `${restoredIds.length} sections (${restoredIds.map(titleOf).join(", ")})`;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8">
        <header className="mb-6 border-b border-border pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {onBackToHub && hasMultipleProposals && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onBackToHub}
                    className="h-6 -ml-1.5 rounded px-1.5 text-xs font-medium text-brand hover:bg-brand/10 hover:text-brand gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    All proposals
                  </Button>
                )}
                <span className="text-[11px] font-medium text-muted-foreground">
                  Grant application
                </span>
                {isMockMode && <DemoBadge marker="mock-draft" compact />}
              </div>
              <h2 className="mt-1 break-words text-xl font-bold text-foreground sm:text-2xl">
                {doc.grantTitle}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exportAsPdf(doc)}
                className="h-8 rounded-lg gap-1.5 text-xs hover:bg-muted"
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exportAsWord(doc)}
                className="h-8 rounded-lg gap-1.5 text-xs hover:bg-muted"
              >
                <FileDown className="h-3.5 w-3.5" />
                Word
              </Button>

              {onGoToChat && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onGoToChat}
                  className="h-8 rounded-lg gap-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MessagesSquare className="h-3.5 w-3.5" />
                  Chat
                </Button>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{doc.sections.length} sections</span>
            <span>·</span>
            <span>{totalWords} total words</span>
            <span>·</span>
            <span>Saved {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}</span>
            <span>·</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium",
                dirtyCount > 0 ? "text-warning" : "text-success",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  dirtyCount > 0 ? "bg-warning" : "bg-success",
                )}
              />
              {dirtyCount > 0
                ? `${dirtyCount} unsaved edit${dirtyCount === 1 ? "" : "s"}`
                : "All edits saved"}
            </span>
            {doc.sourceUrl && (
              <>
                <span>·</span>
                <a
                  href={doc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Official Call
                </a>
              </>
            )}
          </div>

          {restoredIds.length > 0 && !restoreDismissed && (
            <InlineNotice tone={conflictIds.length > 0 ? "warning" : "empty"} className="mt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  {conflictIds.length > 0 ? (
                    <>
                      Unsaved edits restored to {restoredSummary} — but{" "}
                      {conflictIds.length === 1
                        ? "that section has"
                        : "some of those sections have"}{" "}
                      also been saved since, so the two versions differ. Check the text before
                      saving; Cancel keeps the saved version instead.
                    </>
                  ) : (
                    <>
                      Draft restored — unsaved changes to {restoredSummary} were carried over from
                      your last visit. Save to keep them, or Cancel to go back to the saved text.
                    </>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onDismissRestore}
                  className="h-auto shrink-0 rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
                >
                  Dismiss
                </Button>
              </div>
            </InlineNotice>
          )}

          {!persistenceOk && (
            <InlineNotice tone="warning" className="mt-3">
              Unsaved edits can&apos;t be backed up in this browser right now — local storage may be
              full or unavailable (for example, in private browsing). What you see here is intact,
              but a reload could lose anything you haven&apos;t saved.
            </InlineNotice>
          )}
        </header>

        <div className="space-y-4 pb-12">
          {doc.sections.map((section, idx) => (
            <WorkspaceSection
              key={section.id}
              index={idx + 1}
              section={section}
              draft={drafts[section.id]}
              dirty={isDirty(section.id)}
              savedFlash={savedFlashId === section.id}
              selected={selectedSectionIds.has(section.id)}
              onToggleSelect={() => onToggleSection(section.id)}
              onStartEdit={() => onStartEdit(section.id)}
              onChangeDraft={(value) => onChangeDraft(section.id, value)}
              onCancel={() => onCancel(section.id)}
              onSave={() => onSave(section.id)}
              revealText={streamingSections[section.id]}
              onRevealComplete={() => onRevealComplete(section.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface WorkspaceAiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  tone?: "normal" | "error" | "success";
}

function AssistantBubble({ msg, isLatest }: { msg: WorkspaceAiMessage; isLatest: boolean }) {
  // Only the most recent assistant message streams its reveal — older
  // messages were already painted in earlier turns and shouldn't replay.
  const shouldReveal = isLatest && msg.role === "assistant" && msg.tone !== "error";
  const { revealed } = useProgressiveReveal(shouldReveal ? msg.text : undefined);
  const displayText = shouldReveal ? (revealed ?? msg.text) : msg.text;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg p-3 text-xs leading-relaxed",
        msg.role === "user" && "bg-brand/10 text-foreground self-end max-w-[85%]",
        msg.role === "assistant" &&
          msg.tone === "error" &&
          "bg-destructive/10 text-destructive border border-destructive/20",
        msg.role === "assistant" &&
          msg.tone !== "error" &&
          "bg-muted text-foreground/90 self-start max-w-[95%]",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
        {msg.role === "assistant" ? (
          <>
            <Sparkles className="h-3 w-3 text-brand" />
            <span>Assistant</span>
          </>
        ) : (
          <span>You</span>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words">{displayText}</p>
    </div>
  );
}

/**
 * Side chat panel for the document workspace.
 *
 * Dedicated side chat for IN-DOCUMENT AI operations only — distinct from
 * the main conversation chat in App.tsx. Lets the user ask for revisions
 * ("make the problem statement punchier", "shorten section 3 to 200 words",
 * "strengthen the impact narrative") that apply directly to the open
 * document's sections.
 */
function AssistantPanel({
  doc,
  profile,
  grant,
  drafts,
  selectedSectionIds,
  onSelectAll,
  onClearSelection,
  onApplyRewrite,
}: {
  doc: ApplicationDocument;
  profile: OrganisationProfile | undefined;
  grant: Grant | undefined;
  drafts: Record<string, string>;
  selectedSectionIds: Set<string>;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApplyRewrite: (sectionId: string, text: string) => void;
}) {
  const [messages, setMessages] = useState<WorkspaceAiMessage[]>([
    {
      id: "workspace-ai-welcome",
      role: "assistant",
      text: "Select one or more sections to revise, then describe what you'd like me to improve.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [undoStack, setUndoStack] = useState<Array<{ sectionId: string; previousText: string }>>(
    [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetSelectAllId = useId();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  const targetSections = doc.sections.filter((s) => selectedSectionIds.has(s.id));
  const allSelected = doc.sections.length > 0 && targetSections.length === doc.sections.length;
  const someSelected = targetSections.length > 0 && !allSelected;

  const pushMessage = (
    role: "user" | "assistant",
    text: string,
    tone: "normal" | "error" | "success" = "normal",
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        text,
        createdAt: new Date().toISOString(),
        tone,
      },
    ]);
  };

  const currentTextOf = (sectionId: string) =>
    drafts[sectionId] ?? doc.sections.find((s) => s.id === sectionId)?.content ?? "";

  /** One rewrite call. Returns the previous text on success, so the caller can build the undo record. */
  const runRewrite = async (
    section: DocSection,
    instruction: string,
  ): Promise<{ ok: true; previousText: string } | { ok: false }> => {
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const prompt = value.trim();
    if (!prompt || pending || !profile) return;

    if (targetSections.length === 0) {
      pushMessage("user", prompt);
      pushMessage(
        "assistant",
        "Select at least one section above first so I know which parts of your document to revise.",
      );
      setValue("");
      return;
    }

    setValue("");
    pushMessage("user", prompt);
    setPending(true);

    const batchUndo: Array<{ sectionId: string; previousText: string }> = [];
    let successCount = 0;

    for (const section of targetSections) {
      const res = await runRewrite(section, prompt);
      if (res.ok) {
        batchUndo.push({ sectionId: section.id, previousText: res.previousText });
        successCount += 1;
      }
    }

    setPending(false);

    if (batchUndo.length > 0) {
      setUndoStack((prev) => [...batchUndo, ...prev]);
    }

    if (successCount === 0) return;

    const summary =
      successCount === 1
        ? `Revised "${targetSections[0].title}". The changes are applied in your document above — you can edit further or undo.`
        : `Revised ${successCount} sections (${targetSections.map((s) => s.title).join(", ")}). The changes are applied in your document above — you can edit further or undo.`;
    pushMessage("assistant", summary, "success");
  };

  const handleUndoLatest = () => {
    if (undoStack.length === 0) return;
    const [latest, ...rest] = undoStack;
    setUndoStack(rest);
    onApplyRewrite(latest.sectionId, latest.previousText);
    const title = doc.sections.find((s) => s.id === latest.sectionId)?.title ?? "that section";
    pushMessage("assistant", `Undid the AI revision on "${title}".`);
  };

  return (
    <aside
      aria-label="AI assistant panel"
      className="flex h-full w-full shrink-0 flex-col border-t border-border bg-card lg:w-80 lg:border-l lg:border-t-0 xl:w-96"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground">Document Assistant</h3>
            <p className="text-[10px] text-muted-foreground">Revises selected sections with AI</p>
          </div>
        </div>

        {undoStack.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUndoLatest}
            className="h-7 gap-1 rounded-md px-2 text-[11px] font-medium hover:bg-muted"
          >
            <Undo2 className="h-3 w-3" />
            Undo AI edit
          </Button>
        )}
      </div>

      <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={targetSelectAllId}
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => {
                if (checked === true) onSelectAll();
                else onClearSelection();
              }}
              aria-label={allSelected ? "Clear section selection" : "Select all sections"}
            />
            <label
              htmlFor={targetSelectAllId}
              className="cursor-pointer text-[11px] font-medium text-foreground"
            >
              {targetSections.length === 0
                ? "No sections targeted"
                : `${targetSections.length} of ${doc.sections.length} targeted`}
            </label>
          </div>
          {targetSections.length > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {messages.map((msg, idx) => (
          <AssistantBubble key={msg.id} msg={msg} isLatest={idx === messages.length - 1} />
        ))}

        {pending && (
          <div className="flex items-center gap-2 self-start rounded-lg bg-muted p-3 text-xs text-muted-foreground motion-safe:animate-pulse">
            <Sparkles className="h-3.5 w-3.5 text-brand motion-safe:animate-spin" />
            <span>Revising {targetSections.length} section(s) with AI…</span>
          </div>
        )}
      </div>

      {!profile && (
        <div className="border-t border-border bg-warning/10 p-3 text-[11px] text-warning">
          Organisation profile missing — submit your details in chat to enable AI revisions.
        </div>
      )}

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
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
            placeholder={
              targetSections.length === 0
                ? "Select a section above, then ask to revise it…"
                : targetSections.length === 1
                  ? `Ask to revise "${targetSections[0].title}"…`
                  : "Ask the assistant to revise your document…"
            }
            className="min-h-0 resize-none rounded-lg text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={pending || !profile || !value.trim() || targetSections.length === 0}
            aria-label="Send"
            className="shrink-0 rounded-lg bg-brand text-white hover:bg-brand/90"
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
  onSectionChange,
  onBackToHub,
  hasMultipleProposals,
  onGoToChat,
}: {
  doc: ApplicationDocument;
  profile: OrganisationProfile | undefined;
  grant: Grant | undefined;
  onSectionChange: (sectionId: string, content: string) => void;
  onBackToHub?: () => void;
  hasMultipleProposals?: boolean;
  onGoToChat?: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restoredIds, setRestoredIds] = useState<string[]>([]);
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [restoreDismissed, setRestoreDismissed] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(() => new Set());
  const [streamingSections, setStreamingSections] = useState<Record<string, string>>({});

  const { restore, persistenceOk, flush: flushDrafts } = useDrafts(doc, drafts);

  useEffect(() => {
    if (!restore) return;
    setDrafts((prev) => {
      const merged = { ...prev };
      for (const [sectionId, text] of Object.entries(restore.sections)) {
        if (!(sectionId in merged)) merged[sectionId] = text;
      }
      return merged;
    });
    setRestoredIds(Object.keys(restore.sections));
    setConflictIds(restore.conflictSectionIds);
    setRestoreDismissed(false);
  }, [restore]);

  const forgetRestored = (id: string) => {
    setRestoredIds((prev) => prev.filter((restoredId) => restoredId !== id));
    setConflictIds((prev) => prev.filter((conflictId) => conflictId !== id));
  };

  const flushRequestedRef = useRef(false);
  const requestDraftFlush = () => {
    flushRequestedRef.current = true;
  };

  useEffect(() => {
    if (!flushRequestedRef.current) return;
    flushRequestedRef.current = false;
    flushDrafts();
  }, [drafts, flushDrafts]);

  const flashSaved = (id: string) => {
    setSavedFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlashId(null), 1600);
  };

  const startEdit = (id: string) => {
    const savedContent = doc.sections.find((s) => s.id === id)?.content ?? "";
    setDrafts((prev) => (prev[id] !== undefined ? prev : { ...prev, [id]: savedContent }));
  };

  const updateDraft = (id: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const clearDraft = (id: string) => {
    setDrafts((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const cancelEdit = (id: string) => {
    clearDraft(id);
    forgetRestored(id);
    requestDraftFlush();
  };

  const commitSection = (id: string, text: string) => {
    onSectionChange(id, text);
    clearDraft(id);
    forgetRestored(id);
    requestDraftFlush();
    flashSaved(id);
  };

  const save = (id: string) => {
    const draft = drafts[id];
    if (draft === undefined) return;
    commitSection(id, draft);
  };

  const applyAiRewrite = (id: string, text: string) => {
    commitSection(id, text);
    setStreamingSections((prev) => ({ ...prev, [id]: text }));
  };
  const toggleSection = (id: string) => {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllSections = () => {
    setSelectedSectionIds(new Set(doc.sections.map((s) => s.id)));
  };

  const clearSelection = () => {
    setSelectedSectionIds(new Set());
  };

  const clearStreaming = (id: string) => {
    setStreamingSections((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:overflow-hidden">
      <WorkspaceEditor
        doc={doc}
        drafts={drafts}
        savedFlashId={savedFlashId}
        restoredIds={restoredIds}
        conflictIds={conflictIds}
        restoreDismissed={restoreDismissed}
        persistenceOk={persistenceOk}
        selectedSectionIds={selectedSectionIds}
        onToggleSection={toggleSection}
        onDismissRestore={() => setRestoreDismissed(true)}
        onStartEdit={startEdit}
        onChangeDraft={updateDraft}
        onCancel={cancelEdit}
        onSave={save}
        streamingSections={streamingSections}
        onRevealComplete={clearStreaming}
        onBackToHub={onBackToHub}
        hasMultipleProposals={hasMultipleProposals}
        onGoToChat={onGoToChat}
      />
      <AssistantPanel
        doc={doc}
        profile={profile}
        grant={grant}
        drafts={drafts}
        selectedSectionIds={selectedSectionIds}
        onSelectAll={selectAllSections}
        onClearSelection={clearSelection}
        onApplyRewrite={applyAiRewrite}
      />
    </div>
  );
}

/**
 * Full-page document editor with a side chat panel — Cursor / Google-Docs
 * style, as a sibling main view of chat/pipeline/saved (see App.tsx's
 * `mainView`), not a route and not a ChatBlock.
 */
export function DocumentWorkspace({
  doc,
  profile,
  grant,
  onSectionChange,
  onGoToChat,
  conversations,
  activeConversationId,
  onSelectConversation,
}: {
  doc: ApplicationDocument | undefined;
  profile: OrganisationProfile | undefined;
  grant: Grant | undefined;
  onSectionChange: (sectionId: string, content: string) => void;
  onGoToChat: () => void;
  conversations?: Conversation[];
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
}) {
  const goToChat = useCallback(() => onGoToChat(), [onGoToChat]);
  const [showHub, setShowHub] = useState(false);

  // List of all conversations with drafted documents
  const docConversations = useMemo(() => {
    if (!conversations) return [];
    return conversations.filter((c) => Boolean(c.document));
  }, [conversations]);

  // When a new doc is selected/loaded, ensure editor is shown
  useEffect(() => {
    setShowHub(false);
  }, [doc?.id]);

  if (!doc || showHub) {
    if (docConversations.length > 0) {
      return (
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-background p-6 sm:p-8">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <header className="border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                    Proposal Workspaces
                  </h2>
                  {docConversations.length > 0 && (
                    <span
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums"
                      aria-label={`${docConversations.length} proposals`}
                    >
                      {docConversations.length}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select an active application draft to edit and revise with AI in full-page
                  workspace view.
                </p>
              </div>
            </header>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {docConversations.map((conv) => {
                const d = conv.document!;
                const totalWords = d.sections.reduce((acc, s) => acc + wordCount(s.content), 0);
                const isSelected = conv.id === activeConversationId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setShowHub(false);
                      onSelectConversation?.(conv.id);
                    }}
                    className={cn(
                      "group relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all hover:border-brand/50 hover:shadow-md",
                      isSelected ? "border-brand/60 bg-brand/[0.03]" : "border-border bg-card",
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                          {d.programme || "Grant Proposal"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-foreground group-hover:text-brand transition-colors line-clamp-2">
                        {d.grantTitle}
                      </h3>
                      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{d.sections.length} sections</span>
                        <span>·</span>
                        <span>{totalWords} words</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                      <span className="text-xs font-medium text-brand group-hover:underline">
                        Open workspace &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

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
      onSectionChange={onSectionChange}
      onBackToHub={() => setShowHub(true)}
      hasMultipleProposals={docConversations.length > 1}
      onGoToChat={goToChat}
    />
  );
}
