import { useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  FileDown,
  FileText,
  KanbanSquare,
  ListOrdered,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type {
  ApplicationDocument,
  DocumentSection as DocSection,
  Grant,
  OrganisationProfile,
} from "@/types";
import type { ApplicationStatus } from "@/data/mockApplications";
import { exportAsPdf, exportAsWord } from "@/utils/export";
import { applicationService } from "@/services";
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
import { Badge } from "@/components/ui/badge";
import { InlineNotice } from "@/components/common/InlineNotice";
import {
  STATUS_BADGE,
  STATUS_LABEL,
  STATUS_ORDER,
  isStatus,
} from "@/components/pipeline/statusPresentation";
import { wordCount, stripLeadingNumber } from "@/utils/text";

interface Props {
  doc: ApplicationDocument;
  profile?: OrganisationProfile;
  grant?: Grant;
  onSectionChange: (sectionId: string, content: string) => void;
  /** This draft's pipeline status; undefined when no application row matches. */
  applicationStatus?: ApplicationStatus;
  onApplicationStatusChange?: (status: ApplicationStatus) => void;
  onViewInPipeline?: (applicationId?: string) => void;
  /** Switches to the full-page document workspace for this application. */
  onOpenWorkspace?: () => void;
  /**
   * When true the full editor is hidden and a compact read-only summary is
   * shown instead. Set by the conversation when a newer draft has been started
   * for a different grant in the same chat.
   */
  superseded?: boolean;
}

export function ApplicationDocumentView({
  doc,
  profile,
  grant,
  onSectionChange,
  applicationStatus,
  onApplicationStatusChange,
  onViewInPipeline,
  onOpenWorkspace,
  superseded,
}: Props) {
  const sections = doc?.sections ?? [];
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [rewriteError, setRewriteError] = useState<{ sectionId: string; message: string } | null>(
    null,
  );
  const [exportError, setExportError] = useState<"pdf" | "word" | null>(null);
  const [showContents, setShowContents] = useState(false);

  if (sections.length === 0) {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <InlineNotice tone="empty">
          This application draft does not have any sections available yet.
        </InlineNotice>
      </Card>
    );
  }

  if (superseded) {
    return (
      <Card className="rounded-2xl border bg-muted/30 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Grant application draft · archived
              </span>
            </div>
            <h3 className="mt-0.5 break-words text-sm font-semibold text-foreground">
              {doc.grantTitle}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sections.length} section{sections.length === 1 ? "" : "s"} · last saved{" "}
              {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportAsPdf(doc)}
              className="rounded-lg text-xs hover:bg-muted"
            >
              <FileDown className="h-3 w-3" />
              PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void exportAsWord(doc)}
              className="rounded-lg text-xs hover:bg-muted"
            >
              <FileDown className="h-3 w-3" />
              Word
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const totalWords = sections.reduce((acc, s) => acc + wordCount(s.content), 0);

  const performRewrite = async (section: DocSection) => {
    if (!profile) return;
    setRewritingId(section.id);
    setRewriteError(null);
    try {
      const next = await applicationService.rewriteSection(
        section.title,
        section.content,
        profile,
        grant,
        doc.id,
      );
      onSectionChange(section.id, next);
    } catch (err) {
      setRewriteError({
        sectionId: section.id,
        message: err instanceof Error ? err.message : "The rewrite didn't finish.",
      });
    } finally {
      setRewritingId(null);
    }
  };

  const handleExportPdf = () => {
    setExportError(exportAsPdf(doc) ? null : "pdf");
  };
  const handleExportWord = async () => {
    const ok = await exportAsWord(doc);
    setExportError(ok ? null : "word");
  };

  return (
    <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-md sm:p-6">
      <CardHeader className="mb-6 flex flex-col gap-3 border-b border-border p-0 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 sm:flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                {doc.programme || grant?.programme || "Grant application draft"}
              </span>
            </div>
            <h3 className="mt-1 break-words text-lg font-bold text-foreground">{doc.grantTitle}</h3>
            {(doc.sourceUrl || grant?.sourceUrl) && (
              <div className="mt-1">
                <a
                  href={doc.sourceUrl || grant?.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Official Call on Portal
                </a>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            {onOpenWorkspace && (
              <Button
                type="button"
                size="sm"
                onClick={onOpenWorkspace}
                className="rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90"
              >
                <FileText className="h-3.5 w-3.5" />
                Open full workspace
              </Button>
            )}
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

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            All changes saved
          </span>
          <span>
            Last saved {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
          </span>
        </div>

        {Boolean(onViewInPipeline || applicationStatus) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-[11px] font-medium text-muted-foreground">Pipeline status</span>

            {onApplicationStatusChange ? (
              <Select
                value={applicationStatus ?? "drafting"}
                onValueChange={(value) => {
                  if (isStatus(value)) onApplicationStatusChange(value);
                }}
              >
                <SelectTrigger
                  aria-label="Change pipeline status for this application"
                  className="h-8 w-auto min-w-36 px-2 text-xs transition-colors hover:border-brand/50 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((status) => (
                    <SelectItem key={status} value={status} className="text-xs">
                      {STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 whitespace-nowrap font-medium transition-colors duration-200",
                  STATUS_BADGE[applicationStatus ?? "drafting"],
                )}
              >
                <span className="sr-only">Status: </span>
                {STATUS_LABEL[applicationStatus ?? "drafting"]}
              </Badge>
            )}

            {onViewInPipeline && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onViewInPipeline(doc.id)}
                className="h-8 rounded-lg text-xs hover:bg-muted"
              >
                <KanbanSquare className="h-3.5 w-3.5" />
                View in pipeline
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6 p-0">
        {/* Table of Contents Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowContents((v) => !v)}
            className="h-8 gap-2 rounded-lg border-border bg-card text-xs font-medium hover:bg-muted"
          >
            <ListOrdered className="h-3.5 w-3.5" />
            <span>Table of Contents ({doc.sections.length} sections)</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                showContents && "rotate-180",
              )}
            />
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums font-semibold text-foreground">{totalWords}</span> words
            <span>•</span>
            <span>{doc.sections.length} sections</span>
          </div>
        </div>

        {/* Expandable Table of Contents Grid */}
        {showContents && (
          <div className="rounded-xl border border-border bg-muted/20 p-4 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Document Sections
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowContents(false)}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {doc.sections.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      document
                        .getElementById(`app-doc-section-${s.id}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="flex w-full items-start justify-between gap-2 rounded-lg border border-border/60 bg-card p-2.5 text-left text-xs transition-all hover:border-brand/40 hover:bg-brand/5 text-foreground"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-brand mr-1.5">{i + 1}.</span>
                      <span className="truncate">{stripLeadingNumber(s.title)}</span>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {wordCount(s.content)}w
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Continuous Document Flow */}
        <div className="space-y-6">
          {doc.sections.map((section, i) => {
            const isRewriting = rewritingId === section.id;
            return (
              <article
                key={section.id}
                id={`app-doc-section-${section.id}`}
                className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-colors"
              >
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                  <h4 className="text-sm sm:text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-brand tabular-nums">
                      {i + 1}.
                    </span>
                    <span>{stripLeadingNumber(section.title)}</span>
                  </h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                      {wordCount(section.content)}w
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void performRewrite(section)}
                      disabled={isRewriting || !profile}
                      className="h-7 px-2 text-xs gap-1.5 rounded-lg border-border hover:bg-muted"
                    >
                      {isRewriting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 text-brand" />
                      )}
                      <span>Rewrite with AI</span>
                    </Button>
                  </div>
                </div>

                {rewriteError?.sectionId === section.id && (
                  <InlineNotice tone="error" className="mb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>{rewriteError.message}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRewriteError(null)}
                        className="h-auto text-xs"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </InlineNotice>
                )}

                <p className="whitespace-pre-wrap break-words text-sm sm:text-[14.5px] leading-relaxed text-foreground/90 font-normal [overflow-wrap:anywhere]">
                  {section.content}
                </p>
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
