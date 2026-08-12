import { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Pencil,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type {
  ApplicationDocument,
  DocumentSection as DocSection,
  Grant,
  OrganisationProfile,
} from "@/types";
import { exportAsPdf, exportAsWord } from "@/utils/export";
import { applicationService } from "@/services";
import { useDrafts } from "@/hooks/useDrafts";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InlineNotice } from "@/components/common/InlineNotice";
import { DemoBadge } from "@/components/common/DemoBadge";
import { wordCount } from "@/utils/text";

interface Props {
  doc: ApplicationDocument;
  profile?: OrganisationProfile;
  grant?: Grant;
  onSectionChange: (sectionId: string, content: string) => void;
}

// A rewrite is only treated as "replacing manual edits" once the in-progress
// draft has diverged from the last-saved content by more than a trivial
// amount — small tweaks (a typo fix, a comma) shouldn't trigger a prompt.
const MANUAL_EDIT_CONFIRM_THRESHOLD = 40;

// Shared by the section toolbar's Undo/Rewrite/Edit/Cancel buttons — Save
// uses its own (brand-coloured) variant since it isn't a plain outline action.
const TOOLBAR_BUTTON_CLS = "h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted";

interface LastRewrite {
  sectionId: string;
  previousText: string;
  /** Whether the rewrite replaced an in-progress draft, or committed content directly. */
  wasEditing: boolean;
}

export function ApplicationDocumentView({ doc, profile, grant, onSectionChange }: Props) {
  const sectionSelectId = useId();
  const [activeId, setActiveId] = useState(doc.sections[0]?.id ?? "");
  // sectionId -> in-progress text. A section is "in edit mode" iff it has a
  // key here — this map lives above the active-section view, so switching
  // sections (or the mobile dropdown) never discards an unsaved draft.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [rewriteError, setRewriteError] = useState<{ sectionId: string; message: string } | null>(
    null,
  );
  const [saveError, setSaveError] = useState<{ sectionId: string; message: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const [pendingRewriteId, setPendingRewriteId] = useState<string | null>(null);
  const [lastRewrite, setLastRewrite] = useState<LastRewrite | null>(null);
  const [exportError, setExportError] = useState<"pdf" | "word" | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sections whose text came back from the unsaved-edit buffer on this load.
  // Kept so the restore notice can name them and disappear once they're all
  // resolved — it isn't a toast that fires and forgets.
  const [restoredIds, setRestoredIds] = useState<string[]>([]);
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [restoreDismissed, setRestoreDismissed] = useState(false);

  const {
    restore,
    persistenceOk: draftsPersistenceOk,
    flush: flushDrafts,
  } = useDrafts(doc, drafts);

  // Put the buffer back once, on load. Existing keys win: if the user has
  // already started typing before hydration finished, their live text is
  // newer than anything on disk and must not be clobbered.
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

  // Save/Cancel need the buffer written *after* React has applied the new
  // drafts map, not with the stale one the handler can still see. The flag is
  // consumed by an effect that runs after the hook's own mirror effect has
  // staged the new value.
  const flushRequestedRef = useRef(false);
  const requestDraftFlush = () => {
    flushRequestedRef.current = true;
  };

  useEffect(() => {
    if (!flushRequestedRef.current) return;
    flushRequestedRef.current = false;
    flushDrafts();
  }, [drafts, flushDrafts]);

  const activeIndex = Math.max(
    0,
    doc.sections.findIndex((s) => s.id === activeId),
  );
  const activeSection = doc.sections[activeIndex] ?? doc.sections[0];

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
    if (lastRewrite?.sectionId === id) setLastRewrite(null);
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
    if (lastRewrite?.sectionId === id) setLastRewrite(null);
    forgetRestored(id);
    // Discarded text must not outlive the click, even for the 500ms of the
    // debounce — a reload inside that window would bring it back.
    requestDraftFlush();
  };

  const save = async (id: string) => {
    const draft = drafts[id];
    if (draft === undefined) return;
    setSavingId(id);
    setSaveError(null);
    try {
      await applicationService.saveSection(doc.id, id, draft);
      onSectionChange(id, draft);
      clearDraft(id);
      if (lastRewrite?.sectionId === id) setLastRewrite(null);
      forgetRestored(id);
      // The text now lives in the committed document, so drop the buffer
      // entry immediately rather than leaving a duplicate on disk.
      requestDraftFlush();
      flashSaved(id);
    } catch (err) {
      setSaveError({
        sectionId: id,
        message: err instanceof Error ? err.message : "The section could not be saved.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const performRewrite = async (section: DocSection) => {
    if (!profile) return;
    const isEditingSection = drafts[section.id] !== undefined;
    const currentText = isEditingSection ? drafts[section.id] : section.content;
    setRewritingId(section.id);
    setRewriteError(null);
    try {
      const next = await applicationService.rewriteSection(
        section.title,
        currentText,
        profile,
        grant,
        doc.id,
      );
      setLastRewrite({
        sectionId: section.id,
        previousText: currentText,
        wasEditing: isEditingSection,
      });
      if (isEditingSection) {
        setDrafts((prev) => ({ ...prev, [section.id]: next }));
      } else {
        onSectionChange(section.id, next);
        flashSaved(section.id);
      }
    } catch (err) {
      // The rewrite is the only step here that can fail, and it fails
      // harmlessly — the section still holds whatever it held before, so the
      // notice says so rather than implying lost work.
      setRewriteError({
        sectionId: section.id,
        message: err instanceof Error ? err.message : "The rewrite didn't finish.",
      });
    } finally {
      setRewritingId(null);
    }
  };

  const requestRewrite = (section: DocSection) => {
    const draft = drafts[section.id];
    const manuallyEdited =
      draft !== undefined &&
      draft.trim() !== section.content.trim() &&
      draft.trim().length > MANUAL_EDIT_CONFIRM_THRESHOLD;
    if (manuallyEdited) {
      setPendingRewriteId(section.id);
      return;
    }
    void performRewrite(section);
  };

  const undoRewrite = () => {
    if (!lastRewrite) return;
    if (lastRewrite.wasEditing) {
      setDrafts((prev) => ({ ...prev, [lastRewrite.sectionId]: lastRewrite.previousText }));
    } else {
      onSectionChange(lastRewrite.sectionId, lastRewrite.previousText);
      flashSaved(lastRewrite.sectionId);
    }
    setLastRewrite(null);
  };

  const handleExportPdf = () => {
    setExportError(exportAsPdf(doc) ? null : "pdf");
  };
  const handleExportWord = () => {
    setExportError(exportAsWord(doc) ? null : "word");
  };

  const goToSection = (id: string) => setActiveId(id);
  const prevSection = doc.sections[activeIndex - 1];
  const nextSection = doc.sections[activeIndex + 1];
  const pendingRewriteSection = doc.sections.find((s) => s.id === pendingRewriteId) ?? null;

  return (
    <TooltipProvider delayDuration={300}>
      <Card className="rounded-2xl p-4 shadow-sm sm:p-6">
        <CardHeader className="mb-5 flex flex-col gap-3 border-b border-border p-0 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0 sm:flex-1">
              {/* The whole document is generated prose. Marked once, at the
                  top, rather than on all twelve sections. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-medium text-brand">Grant application draft</span>
                <DemoBadge marker="mock-draft" compact />
              </div>
              <h3 className="mt-1 break-words text-lg font-semibold text-foreground">
                {doc.grantTitle}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Edit each section, use the AI rewrite tool when connected, then export your
                application.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                className="rounded-lg hover:bg-muted"
              >
                <FileDown className="h-3.5 w-3.5" />
                Export as PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportWord}
                className="rounded-lg hover:bg-muted"
              >
                <FileDown className="h-3.5 w-3.5" />
                Export as Word
              </Button>
            </div>
          </div>

          {exportError && (
            <InlineNotice tone="error">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {exportError === "pdf"
                    ? "Couldn't open the PDF preview — your browser may have blocked the pop-up window."
                    : "Couldn't create the Word file — your browser may have blocked the download."}{" "}
                  Allow pop-ups or downloads for this site, then try again.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exportError === "pdf" ? handleExportPdf : handleExportWord}
                  className="h-auto shrink-0 rounded-md border-destructive/40 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                >
                  Retry
                </Button>
              </div>
            </InlineNotice>
          )}

          {/* InlineNotice gives non-error tones role="status", so both of
              these are announced politely and neither steals focus. */}
          {restoredIds.length > 0 && !restoreDismissed && (
            <InlineNotice tone={conflictIds.length > 0 ? "warning" : "empty"}>
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

          {!draftsPersistenceOk && (
            <InlineNotice tone="warning">
              Unsaved edits can&apos;t be backed up in this browser right now — local storage may be
              full or unavailable (for example, in private browsing). What you see here is intact,
              but a reload could lose anything you haven&apos;t saved.
            </InlineNotice>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
        </CardHeader>

        <CardContent className="flex flex-col gap-4 p-0 md:flex-row md:gap-6">
          <nav aria-label="Application sections" className="hidden shrink-0 md:block md:w-52">
            <ul className="space-y-1">
              {doc.sections.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goToSection(s.id)}
                    aria-current={s.id === activeSection.id ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                      s.id === activeSection.id
                        ? "bg-brand/10 font-medium text-brand"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="mt-px shrink-0 tabular-nums">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {isDirty(s.id) && (
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                        aria-label="Unsaved changes"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => prevSection && goToSection(prevSection.id)}
              disabled={!prevSection}
              aria-label="Previous section"
              className="shrink-0 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <label htmlFor={sectionSelectId} className="sr-only">
              Jump to section
            </label>
            <Select value={activeSection?.id} onValueChange={goToSection}>
              <SelectTrigger id={sectionSelectId} className="w-full rounded-lg text-left text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {doc.sections.map((s, i) => (
                  <SelectItem key={s.id} value={s.id}>
                    {i + 1}. {s.title}
                    {isDirty(s.id) ? " • unsaved" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => nextSection && goToSection(nextSection.id)}
              disabled={!nextSection}
              aria-label="Next section"
              className="shrink-0 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {activeSection && (
            <div className="min-w-0 flex-1">
              <SectionEditor
                index={activeIndex + 1}
                section={activeSection}
                draft={drafts[activeSection.id]}
                dirty={isDirty(activeSection.id)}
                rewriting={rewritingId === activeSection.id}
                rewriteError={
                  rewriteError?.sectionId === activeSection.id ? rewriteError.message : undefined
                }
                saveError={
                  saveError?.sectionId === activeSection.id ? saveError.message : undefined
                }
                onDismissRewriteError={() => setRewriteError(null)}
                onDismissSaveError={() => setSaveError(null)}
                savedFlash={savedFlashId === activeSection.id}
                saving={savingId === activeSection.id}
                canUndoRewrite={lastRewrite?.sectionId === activeSection.id}
                rewriteAvailable={Boolean(profile)}
                onStartEdit={() => startEdit(activeSection.id)}
                onChangeDraft={(value) => updateDraft(activeSection.id, value)}
                onCancel={() => cancelEdit(activeSection.id)}
                onSave={() => void save(activeSection.id)}
                onRewrite={() => requestRewrite(activeSection)}
                onUndoRewrite={undoRewrite}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={pendingRewriteId !== null}
        onOpenChange={(open) => !open && setPendingRewriteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace your edits with a rewrite?</DialogTitle>
            <DialogDescription>
              {pendingRewriteSection
                ? `"${pendingRewriteSection.title}" has manually edited text that hasn't been saved yet. Running the local rewrite will replace it in the editor. You'll get one undo right after it runs.`
                : "This section has manually edited text that hasn't been saved yet."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRewriteId(null)}
              className="rounded-lg hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const section = pendingRewriteSection;
                setPendingRewriteId(null);
                if (section) void performRewrite(section);
              }}
              className="rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90"
            >
              Replace with rewrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function SectionEditor({
  index,
  section,
  draft,
  dirty,
  rewriting,
  rewriteError,
  saveError,
  onDismissRewriteError,
  onDismissSaveError,
  savedFlash,
  saving,
  canUndoRewrite,
  rewriteAvailable,
  onStartEdit,
  onChangeDraft,
  onCancel,
  onSave,
  onRewrite,
  onUndoRewrite,
}: {
  index: number;
  section: DocSection;
  draft: string | undefined;
  dirty: boolean;
  rewriting: boolean;
  rewriteError?: string;
  saveError?: string;
  onDismissRewriteError: () => void;
  onDismissSaveError: () => void;
  savedFlash: boolean;
  saving: boolean;
  canUndoRewrite: boolean;
  rewriteAvailable: boolean;
  onStartEdit: () => void;
  onChangeDraft: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onRewrite: () => void;
  onUndoRewrite: () => void;
}) {
  const editing = draft !== undefined;
  const displayText = editing ? draft : section.content;

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-semibold text-foreground">
            {index}. {section.title}
          </h4>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{wordCount(displayText)} words</span>
            {dirty && <span className="font-medium text-warning">Unsaved changes</span>}
            {savedFlash && (
              <span className="inline-flex items-center gap-1 font-medium text-success">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
            {/* Shown exactly while a rewrite is undoable — i.e. while this
                section's text is the one the mock rewriter just produced. */}
            {canUndoRewrite && <DemoBadge marker="mock-draft" compact />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
          {canUndoRewrite && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onUndoRewrite}
                  className={TOOLBAR_BUTTON_CLS}
                >
                  <Undo2 className="h-3 w-3" />
                  Undo rewrite
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Restore the text from before the last rewrite
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={onRewrite}
                disabled={rewriting || !rewriteAvailable}
                className={TOOLBAR_BUTTON_CLS}
              >
                {rewriting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Rewrite with AI
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Rewrite this section with the connected grant agent
            </TooltipContent>
          </Tooltip>
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              onClick={onStartEdit}
              className={TOOLBAR_BUTTON_CLS}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className={TOOLBAR_BUTTON_CLS}
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onSave}
                disabled={!dirty || saving}
                className="h-auto rounded-md bg-brand px-2 py-1 text-[11px] font-medium text-white hover:bg-brand/90 disabled:bg-muted disabled:text-muted-foreground"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Announced politely so a screen reader hears the rewrite start and
          finish; the visible signal is the spinner in the toolbar button. */}
      <span aria-live="polite" className="sr-only">
        {rewriting ? `Rewriting ${section.title}…` : ""}
      </span>

      {/* role="alert" comes from InlineNotice's error tone, so a failed
          rewrite is announced without moving focus out of the editor. */}
      {rewriteError && !rewriting && (
        <InlineNotice tone="error" className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              {rewriteError} This section still has the text it had before, so nothing was lost.
            </span>
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRewrite}
                className="h-auto rounded-md border-destructive/40 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
              >
                Try again
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDismissRewriteError}
                className="h-auto rounded-md px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </InlineNotice>
      )}

      {saveError && !saving && (
        <InlineNotice tone="error" className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              {saveError} Your draft is still in the editor, so nothing was lost.
            </span>
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSave}
                className="h-auto rounded-md border-destructive/40 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
              >
                Try again
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDismissSaveError}
                className="h-auto rounded-md px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </InlineNotice>
      )}

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => onChangeDraft(e.target.value)}
          rows={14}
          className="min-h-[320px] w-full resize-y break-words rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none [overflow-wrap:anywhere] focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85 [overflow-wrap:anywhere]">
          {section.content}
        </p>
      )}
    </div>
  );
}
