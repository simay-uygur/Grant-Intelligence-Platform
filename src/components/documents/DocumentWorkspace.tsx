import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FileText, MessagesSquare, Pencil, Send, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ApplicationDocument, DocumentSection as DocSection } from "@/types";
import { useDrafts } from "@/hooks/useDrafts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineNotice } from "@/components/common/InlineNotice";
import { DemoBadge } from "@/components/common/DemoBadge";
import { EmptyState } from "@/components/EmptyState";
import { wordCount } from "@/utils/text";

/**
 * One section, always visible (not one-at-a-time like the chat's document
 * card) — the Google-Docs feel this view is going for. Reuses the exact same
 * edit/save/cancel semantics as ApplicationDocumentView's SectionEditor:
 * presence of a key in `drafts` means "in edit mode", Save commits via
 * `onSectionChange`, Cancel discards. Deliberately does NOT include
 * Rewrite-with-AI, Undo, export, or the pipeline-status control — those stay
 * on the chat's document card; this is a structure-only editing surface.
 */
function WorkspaceSection({
  index,
  section,
  draft,
  dirty,
  savedFlash,
  onStartEdit,
  onChangeDraft,
  onCancel,
  onSave,
}: {
  index: number;
  section: DocSection;
  draft: string | undefined;
  dirty: boolean;
  savedFlash: boolean;
  onStartEdit: () => void;
  onChangeDraft: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const editing = draft !== undefined;
  const displayText = editing ? draft : section.content;

  return (
    <section aria-labelledby={`workspace-section-${section.id}`} className="scroll-mt-4">
      <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3
            id={`workspace-section-${section.id}`}
            className="break-words text-base font-semibold text-foreground"
          >
            {index}. {section.title}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{wordCount(displayText)} words</span>
            {dirty && <span className="font-medium text-warning">Unsaved changes</span>}
            {savedFlash && (
              <span className="inline-flex items-center gap-1 font-medium text-success">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
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
          {section.content}
        </p>
      )}
    </section>
  );
}

function WorkspaceEditor({
  doc,
  onSectionChange,
}: {
  doc: ApplicationDocument;
  onSectionChange: (sectionId: string, content: string) => void;
}) {
  // Same in-progress-edit model as ApplicationDocumentView: presence of a key
  // means that section is being edited. Everything below mirrors that
  // component's save/cancel/restore logic exactly, so switching between the
  // chat's document card and this workspace for the same document is safe —
  // both read and write the same gi.drafts.v1 buffer.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restoredIds, setRestoredIds] = useState<string[]>([]);
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [restoreDismissed, setRestoreDismissed] = useState(false);

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

  const flashSaved = (id: string) => {
    setSavedFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlashId(null), 1600);
  };

  const startEdit = (id: string) => {
    setDrafts((prev) => (prev[id] !== undefined ? prev : { ...prev, [id]: savedContentOf(id) }));
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

  const save = (id: string) => {
    const draft = drafts[id];
    if (draft === undefined) return;
    onSectionChange(id, draft);
    clearDraft(id);
    forgetRestored(id);
    requestDraftFlush();
    flashSaved(id);
  };

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
                  onClick={() => setRestoreDismissed(true)}
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

        <div className="space-y-10">
          {doc.sections.map((section, i) => (
            <WorkspaceSection
              key={section.id}
              index={i + 1}
              section={section}
              draft={drafts[section.id]}
              dirty={isDirty(section.id)}
              savedFlash={savedFlashId === section.id}
              onStartEdit={() => startEdit(section.id)}
              onChangeDraft={(value) => updateDraft(section.id, value)}
              onCancel={() => cancelEdit(section.id)}
              onSave={() => save(section.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Inert shell — visually a chat panel, functionally not wired to anything yet. */
function AssistantPanelPlaceholder() {
  return (
    <aside
      aria-label="Assistant chat"
      className="flex min-h-0 w-full shrink-0 flex-col border-t border-border lg:w-[380px] lg:border-l lg:border-t-0"
    >
      <header className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ask questions or request edits to this document.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-8">
        <div className="max-w-[220px] text-center">
          <MessagesSquare className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            Ask the assistant to revise your document.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Not connected yet — coming in a later step.
          </p>
        </div>
      </div>

      <form
        // Structure only: nothing is wired yet, so the only reasonable
        // behaviour for a submit is to swallow it, not silently navigate.
        onSubmit={(e) => e.preventDefault()}
        className="shrink-0 border-t border-border p-3"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="workspace-chat-input" className="sr-only">
            Message the assistant
          </label>
          <Textarea
            id="workspace-chat-input"
            disabled
            rows={2}
            placeholder="Ask the assistant to revise your document…"
            className="min-h-0 resize-none rounded-lg text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled
            aria-label="Send (not available yet)"
            className="shrink-0 rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </aside>
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
 *
 * Structure only: the left pane's editing is fully real (same useDrafts
 * buffer, same save semantics as the chat's document card); the right pane
 * is an inert placeholder — see AssistantPanelPlaceholder.
 */
export function DocumentWorkspace({
  doc,
  onSectionChange,
  onGoToChat,
}: {
  doc: ApplicationDocument | undefined;
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
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:overflow-hidden">
      <WorkspaceEditor doc={doc} onSectionChange={onSectionChange} />
      <AssistantPanelPlaceholder />
    </div>
  );
}
