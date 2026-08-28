import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, FileText, MessagesSquare, Pencil, Send, Sparkles, Undo2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type {
  ApplicationDocument,
  DocumentSection as DocSection,
  Grant,
  OrganisationProfile,
} from "@/types";
import { useDrafts } from "@/hooks/useDrafts";
import { useProgressiveReveal } from "@/hooks/useProgressiveReveal";
import { grantService } from "@/services";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineNotice } from "@/components/common/InlineNotice";
import { DemoBadge } from "@/components/common/DemoBadge";
import { EmptyState } from "@/components/EmptyState";
import { wordCount } from "@/utils/text";

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
            aria-label={`Select ${section.title} for AI editing`}
            className="mt-1 shrink-0"
          />
          <div className="min-w-0">
            <label htmlFor={checkboxId} className="cursor-pointer">
              <h3
                id={`workspace-section-${section.id}`}
                className="break-words text-base font-semibold text-foreground"
              >
                {index}. {section.title}
              </h3>
            </label>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>{wordCount(displayText)} words</span>
              {selected && (
                <span className="font-medium text-brand dark:text-foreground">
                  Selected for AI editing
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

        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStartEdit}
              className="h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
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
                className="h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
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
          className="min-h-[220px] w-full resize-y break-words rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] focus-visible:border-brand/60 focus-visible:ring-brand/20"
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-[1.8] text-foreground/85 [overflow-wrap:anywhere]">
          {displayText}
          {revealing && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] bg-brand motion-safe:animate-pulse dark:bg-foreground"
            />
          )}
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
}: {
  doc: ApplicationDocument;
  drafts: Record<string, string>;
  savedFlashId: string | null;
  restoredIds: string[];
  conflictIds: string[];
  restoreDismissed: boolean;
  persistenceOk: boolean;
  selectedSectionIds: ReadonlySet<string>;
  onToggleSection: (id: string) => void;
  onDismissRestore: () => void;
  onStartEdit: (id: string) => void;
  onChangeDraft: (id: string, value: string) => void;
  onCancel: (id: string) => void;
  onSave: (id: string) => void;
  /** sectionId -> the full text an AI rewrite just produced for it, purely
   * for the progressive-reveal effect (see WorkspaceSection). */
  streamingSections: Record<string, string>;
  onRevealComplete: (id: string) => void;
}) {
  const savedContentOf = (id: string) => doc.sections.find((s) => s.id === id)?.content ?? "";
  const isDirty = (id: string) => {
    const draft = drafts[id];
    return draft !== undefined && draft !== savedContentOf(id);
  };
  const dirtyCount = doc.sections.filter((s) => isDirty(s.id)).length;

  const titleOf = (id: string) => doc.sections.find((s) => s.id === id)?.title ?? "a section";
  const restoredSummary =
    restoredIds.length === 1
      ? `"${titleOf(restoredIds[0])}"`
      : `${restoredIds.length} sections (${restoredIds.map(titleOf).join(", ")})`;

  return (
    <section aria-label="Document editor" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 lg:px-10">
        <header className="mb-8 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] font-medium text-brand">Grant application draft</span>
            <DemoBadge marker="mock-draft" compact />
          </div>
          <h2 className="mt-1 break-words text-xl font-semibold text-foreground">
            {doc.grantTitle}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
                ? `Unsaved changes in ${dirtyCount} section${dirtyCount === 1 ? "" : "s"}`
                : "All changes saved"}
            </span>
            <span>
              Last saved {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
            </span>
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

        {/* Each section is now its own bordered card (see WorkspaceSection),
            so this gap only needs to keep cards apart — not also carry the
            sole visual separation the old borderless layout relied on. */}
        <div className="space-y-6">
          {doc.sections.map((section, i) => (
            <WorkspaceSection
              key={section.id}
              index={i + 1}
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
    </section>
  );
}

interface WorkspaceChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tone?: "error";
}

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
function MessageBubble({ message }: { message: WorkspaceChatMessage }) {
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
 * The working side chat: instruction in, section (or whole document)
 * rewritten out, via the SAME mock service the chat card's "Rewrite (mock
 * AI)" button already calls. Message history is local component state —
 * intentionally not persisted (see the round's brief).
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
  /** Read-only here — used so an instruction rewrites whatever the user is
   * currently looking at, including an in-progress unsaved edit, matching
   * how the chat card's own Rewrite button already behaves. */
  drafts: Record<string, string>;
  selectedSectionIds: ReadonlySet<string>;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApplyRewrite: (sectionId: string, text: string) => void;
}) {
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<{ index: number; total: number; title: string } | null>(
    null,
  );
  const [lastEdit, setLastEdit] = useState<AiEdit[] | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const nextIdRef = useRef(0);
  const inputId = useId();
  const selectAllId = useId();

  const targetSections = doc.sections.filter((s) => selectedSectionIds.has(s.id));
  const allSelected = selectedSectionIds.size === doc.sections.length;

  const nextId = () => {
    nextIdRef.current += 1;
    return `workspace-chat-${nextIdRef.current}`;
  };

  const pushMessage = useCallback((role: "user" | "assistant", text: string, tone?: "error") => {
    setMessages((prev) => [...prev, { id: nextId(), role, text, tone }]);
    if (role === "assistant") setAnnouncement(text);
  }, []);

  const currentTextOf = (sectionId: string) =>
    drafts[sectionId] ?? doc.sections.find((s) => s.id === sectionId)?.content ?? "";

  /** One rewrite call. Returns the previous text on success, so the caller can build the undo record. */
  const runRewrite = async (
    section: DocSection,
    instruction: string,
  ): Promise<{ ok: true; previousText: string } | { ok: false }> => {
    const previousText = currentTextOf(section.id);
    try {
      // profile is guaranteed by the caller (send is disabled without one).
      const next = await grantService.rewriteSection(
        section.title,
        previousText,
        profile as OrganisationProfile,
        grant,
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
    const instruction = value.trim();
    if (!instruction || pending || !profile || targetSections.length === 0) return;
    setValue("");
    pushMessage("user", instruction);
    setPending(true);
    setLastEdit(null);

    // One loop for every case — one section, several, or all: the checkbox
    // selection IS the target list, so there's no separate "apply to all"
    // branch to keep in sync with it.
    const edits: AiEdit[] = [];
    const showProgress = targetSections.length > 1;
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
      pushMessage(
        "assistant",
        edits.length === 1
          ? `Updated "${targetSections[0].title}".`
          : edits.length === targetSections.length
            ? `Applied your instruction to all ${edits.length} selected sections.`
            : `Applied your instruction to ${edits.length} of ${targetSections.length} selected sections before stopping — the rest are unchanged.`,
      );
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

  return (
    <aside
      aria-label="Assistant chat"
      className="flex min-h-0 w-full shrink-0 flex-col border-t border-border lg:w-[380px] lg:border-l lg:border-t-0"
    >
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
          <DemoBadge marker="mock-draft" compact />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Describe a change and it&apos;s applied straight to the document.
        </p>
      </header>

      <div className="shrink-0 border-b border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p role="status" aria-live="polite" className="text-xs text-foreground">
            {selectedSectionIds.size === 0 ? (
              "No sections selected."
            ) : (
              <>
                Editing:{" "}
                <span className="font-medium text-foreground">
                  {allSelected
                    ? `all ${doc.sections.length} sections`
                    : selectedSectionIds.size === 1
                      ? targetSections[0]?.title
                      : `${selectedSectionIds.size} sections`}
                </span>
              </>
            )}
          </p>
          <label
            htmlFor={selectAllId}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium text-foreground"
          >
            <Checkbox
              id={selectAllId}
              checked={selectedSectionIds.size === 0 ? false : allSelected ? true : "indeterminate"}
              onCheckedChange={() => (allSelected ? onClearSelection() : onSelectAll())}
              disabled={pending}
              aria-label="Select all sections"
            />
            Select all
          </label>
        </div>
        {selectedSectionIds.size === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Check at least one section below to enable the assistant.
          </p>
        )}
      </div>

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
              e.g. &ldquo;make this more concise&rdquo; or &ldquo;use a more formal tone&rdquo;.
            </p>
          </div>
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <MessageBubble message={m} />
              </li>
            ))}
            {pending && (
              <li aria-hidden="true" className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/30 px-3.5 py-2.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand dark:text-foreground" />
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

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            Message the assistant
          </label>
          <Textarea
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
            disabled={pending || !profile || targetSections.length === 0}
            rows={2}
            placeholder={
              targetSections.length === 0
                ? "Select at least one section first…"
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
}: {
  doc: ApplicationDocument;
  profile: OrganisationProfile | undefined;
  grant: Grant | undefined;
  onSectionChange: (sectionId: string, content: string) => void;
}) {
  // Same in-progress-edit model as ApplicationDocumentView: presence of a key
  // means that section is being edited. Lifted up from the editor pane (vs.
  // the structure-only version of this component) so the assistant panel can
  // apply an AI rewrite through the exact same commit path as a manual Save —
  // including clearing out any open draft on that section — rather than a
  // second, divergent write path.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restoredIds, setRestoredIds] = useState<string[]>([]);
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [restoreDismissed, setRestoreDismissed] = useState(false);
  // Starts empty on purpose — an instruction must never silently land on
  // section 1 just because nothing was explicitly checked yet.
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(() => new Set());
  // sectionId -> the full text an AI rewrite just produced for it. Purely
  // presentational (see useProgressiveReveal) — commitSection below has
  // already saved the real content by the time this is ever set, so losing
  // this state (e.g. a refresh mid-reveal) loses nothing but the animation.
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

  /** The one write path: manual Save and an applied AI rewrite both funnel through here. */
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

  /**
   * The AI path: commits exactly like a manual Save (same function, same
   * call, same timing — nothing about the save is different or delayed),
   * then separately flags the text for a progressive reveal. The reveal is
   * fire-and-forget from the caller's perspective; it never gates or
   * follows the commit.
   */
  const applyAiRewrite = (id: string, text: string) => {
    commitSection(id, text);
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
  onSectionChange,
  onGoToChat,
}: {
  doc: ApplicationDocument | undefined;
  profile: OrganisationProfile | undefined;
  grant: Grant | undefined;
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
      onSectionChange={onSectionChange}
    />
  );
}
