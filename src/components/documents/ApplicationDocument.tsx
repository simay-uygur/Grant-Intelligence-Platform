import { useState } from "react";
import { Check, FileDown, Loader2, Pencil, Sparkles, X } from "lucide-react";
import type {
  ApplicationDocument,
  DocumentSection as DocSection,
  Grant,
  OrganisationProfile,
} from "@/types";
import { exportAsPdf, exportAsWord } from "@/utils/export";
import { grantService } from "@/services";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  doc: ApplicationDocument;
  profile?: OrganisationProfile;
  grant?: Grant;
  onSectionChange: (sectionId: string, content: string) => void;
}

export function ApplicationDocumentView({ doc, profile, grant, onSectionChange }: Props) {
  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <CardHeader className="mb-5 flex-row flex-wrap items-start justify-between gap-3 space-y-0 border-b border-border p-0 pb-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-brand">
            Grant application draft
          </div>
          <h3 className="mt-1 break-words text-lg font-semibold text-foreground [overflow-wrap:anywhere]">
            {doc.grantTitle}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Edit each section, rewrite with AI, then export.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
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
      </CardHeader>

      <CardContent className="space-y-5 p-0">
        {doc.sections.map((s, i) => (
          <SectionEditor
            key={s.id}
            index={i + 1}
            section={s}
            profile={profile}
            grant={grant}
            onSave={(content) => onSectionChange(s.id, content)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SectionEditor({
  index,
  section,
  profile,
  grant,
  onSave,
}: {
  index: number;
  section: DocSection;
  profile?: OrganisationProfile;
  grant?: Grant;
  onSave: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);
  const [rewriting, setRewriting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const startEdit = () => {
    setDraft(section.content);
    setEditing(true);
  };
  const cancel = () => {
    setDraft(section.content);
    setEditing(false);
  };
  const save = () => {
    onSave(draft);
    setEditing(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };
  const rewrite = async () => {
    if (!profile) return;
    setRewriting(true);
    try {
      const next = await grantService.rewriteSection(
        section.title,
        editing ? draft : section.content,
        profile,
        grant,
      );
      if (editing) setDraft(next);
      else onSave(next);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setRewriting(false);
    }
  };

  return (
    <Card className="rounded-xl bg-background p-4 shadow-none">
      <CardHeader className="mb-2 flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-0">
        <h4 className="min-w-0 break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
          {index}. {section.title}
        </h4>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {savedFlash && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={rewrite}
            disabled={rewriting || !profile}
            className="h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
            title="Rewrite with AI"
          >
            {rewriting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Rewrite with AI
          </Button>
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              onClick={startEdit}
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
                onClick={cancel}
                className="h-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-muted"
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={save}
                className="h-auto rounded-md bg-brand px-2 py-1 text-[11px] font-medium text-white hover:bg-brand/90"
              >
                <Check className="h-3 w-3" />
                Save
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="min-h-[140px] w-full resize-y break-words rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none [overflow-wrap:anywhere] focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
          />
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85 [overflow-wrap:anywhere]">
            {section.content}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
