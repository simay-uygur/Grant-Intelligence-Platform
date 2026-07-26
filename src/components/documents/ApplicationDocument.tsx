import { useRef, useState } from "react";
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
import { grantService } from "@/services";
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

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

interface LastRewrite {
  sectionId: string;
  previousText: string;
  /** Whether the rewrite replaced an in-progress draft, or committed content directly. */
  wasEditing: boolean;
}

export function ApplicationDocumentView({ doc, profile, grant, onSectionChange }: Props) {
  const [activeId, setActiveId] = useState(doc.sections[0]?.id ?? "");
  // sectionId -> in-progress text. A section is "in edit mode" iff it has a
  // key here — this map lives above the active-section view, so switching
  // sections (or the mobile dropdown) never discards an unsaved draft.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const [pendingRewriteId, setPendingRewriteId] = useState<string | null>(null);
  const [lastRewrite, setLastRewrite] = useState<LastRewrite | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  };

  const save = (id: string) => {
    const draft = drafts[id];
    if (draft === undefined) return;
    onSectionChange(id, draft);
    clearDraft(id);
    if (lastRewrite?.sectionId === id) setLastRewrite(null);
    flashSaved(id);
  };

  const performRewrite = async (section: DocSection) => {
    if (!profile) return;
    const isEditingSection = drafts[section.id] !== undefined;
    const currentText = isEditingSection ? drafts[section.id] : section.content;
    setRewritingId(section.id);
    try {
      const next = await grantService.rewriteSection(section.title, currentText, profile, grant);
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
              <div className="text-[11px] font-medium uppercase tracking-wider text-brand">
                Grant application draft
              </div>
              <h3 className="mt-1 break-words text-lg font-semibold text-foreground">
                {doc.grantTitle}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A local writing workspace for this application — edit each section, try the mock
                rewrite tool, then export.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exportAsPdf(doc)}
                className="rounded-lg hover:bg-muted"
              >
                <FileDown className="h-3.5 w-3.5" />
                Export as PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exportAsWord(doc)}
                className="rounded-lg hover:bg-muted"
              >
                <FileDown className="h-3.5 w-3.5" />
                Export as Word
              </Button>
            </div>
          </div>

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
                      "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
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
            <Select value={activeSection?.id} onValueChange={goToSection}>
              <SelectTrigger
                aria-label="Jump to section"
                className="w-full rounded-lg text-left text-sm"
              >
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
                savedFlash={savedFlashId === activeSection.id}
                canUndoRewrite={lastRewrite?.sectionId === activeSection.id}
                rewriteAvailable={Boolean(profile)}
                onStartEdit={() => startEdit(activeSection.id)}
                onChangeDraft={(value) => updateDraft(activeSection.id, value)}
                onCancel={() => cancelEdit(activeSection.id)}
                onSave={() => save(activeSection.id)}
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
                ? `"${pendingRewriteSection.title}" has manually edited text that hasn't been saved yet. Running the mock rewrite will replace it in the editor. You'll get one undo right after it runs.`
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
  savedFlash,
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
  savedFlash: boolean;
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
                  className="h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
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
                className="h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
              >
                {rewriting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Rewrite (mock AI)
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Simulated rewrite using local demo logic — not a real AI model
            </TooltipContent>
          </Tooltip>
          {!editing ? (
            <Button
              type="button"
              variant="outline"
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
                onClick={onCancel}
                className="h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
              <Button
                type="button"
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
