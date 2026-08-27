import type { ApplicationStatus } from "@/data/mockApplications";
import type { ApplicationDocument, ChatBlock, Grant, OrganisationProfile } from "@/types";
import { OrganisationForm } from "@/components/widgets/OrganisationForm";
import { ResearchStatus } from "@/components/widgets/ResearchStatus";
import { GrantResults } from "@/components/grants/GrantResults";
import { ApplicationDocumentView } from "@/components/documents/ApplicationDocument";
import { InlineNotice } from "@/components/common/InlineNotice";
import { AlertCircle, CheckCircle2, Compass } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";

import { DraftProgressCard } from "@/components/widgets/DraftProgressCard";

export interface BlockCallbacks {
  onSubmitProfile: (profile: OrganisationProfile) => void;
  onRetryResearch: () => void;
  onAskGrant: (grant: Grant) => void;
  onStartApplication: (grant: Grant) => void;
  onSectionChange: (sectionId: string, content: string) => void;
  getDocument: (id: string) => ApplicationDocument | undefined;
  getProfile: () => OrganisationProfile | undefined;
  getGrantById: (id: string) => Grant | undefined;
  getApplicationStatus?: (documentId: string) => ApplicationStatus | undefined;
  onUpdateApplicationStatus?: (documentId: string, status: ApplicationStatus) => void;
  onViewInPipeline?: () => void;
  formDisabled?: boolean;
  hasGrantResults?: boolean;
  startingGrantId?: string | null;
  existingGrantIds?: Set<string>;
}

export function BlockRenderer({
  block,
  callbacks,
  isUser,
  showHeader,
  time,
}: {
  block: ChatBlock;
  callbacks: BlockCallbacks;
  /** Assistant text blocks render inside a subtle card; user text keeps the plain paragraph, since the bubble around it (in ChatMessageItem) already provides the container. */
  isUser?: boolean;
  /** When true (assistant text block only), renders the icon + "Grant Intelligence" + timestamp as a header row inside the card, instead of ChatMessageItem rendering that row separately above it. */
  showHeader?: boolean;
  time?: string | null;
}) {
  switch (block.type) {
    case "text":
      return isUser ? (
        <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
          {block.text}
        </p>
      ) : (
        <div className="inline-block max-w-[78%] rounded-2xl border border-border bg-muted/30 px-3.5 py-2.5">
          {showHeader && (
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Compass className="h-3.5 w-3.5" />
              </span>
              <span>Grant Intelligence</span>
              {time && <span className="text-muted-foreground/70">{time}</span>}
            </div>
          )}
          <MarkdownMessage>{block.text}</MarkdownMessage>
        </div>
      );
    case "question":
      return (
        <p className="max-w-prose break-words text-sm font-medium leading-relaxed text-foreground [overflow-wrap:anywhere]">
          {block.text}
        </p>
      );
    case "structured_form":
      return (
        <OrganisationForm
          initial={callbacks.getProfile() ?? block.profile}
          disabled={callbacks.formDisabled}
          onSubmit={callbacks.onSubmitProfile}
        />
      );
    case "research_status":
      return (
        <ResearchStatus
          state={block.state}
          onRetry={block.state.error ? callbacks.onRetryResearch : undefined}
          hasResults={callbacks.hasGrantResults}
        />
      );
    case "draft_progress":
      return <DraftProgressCard state={block.state} />;
    case "grant_results":
      return (
        <GrantResults
          grants={block.grants}
          sourceSummary={block.sourceSummary}
          onAsk={callbacks.onAskGrant}
          onStart={callbacks.onStartApplication}
          // Reuses the existing research retry so a zero-match result can
          // offer a way forward. No new callback, no new block type.
          onRetryResearch={callbacks.onRetryResearch}
          startDisabled={callbacks.formDisabled}
          startingGrantId={callbacks.startingGrantId}
          existingGrantIds={callbacks.existingGrantIds}
        />
      );
    case "document": {
      const doc = callbacks.getDocument(block.documentId);
      if (!doc) {
        // If the card is superseded and we can't find the doc, show a minimal
        // archived notice instead of the "belongs to a different application" text.
        if (block.superseded) {
          return (
            <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium">{block.grantTitle ?? "Grant application"}</span>
              <span>· archived draft</span>
            </div>
          );
        }
        return (
          <InlineNotice tone="empty">
            This application draft isn&apos;t available anymore — it may belong to a different
            application started later in this conversation. Open the most recent application draft,
            or start a new one from a grant&apos;s &quot;Start application&quot; button.
          </InlineNotice>
        );
      }
      const grant = callbacks.getGrantById(doc.grantId);
      return (
        <ApplicationDocumentView
          doc={doc}
          profile={callbacks.getProfile()}
          grant={grant}
          onSectionChange={callbacks.onSectionChange}
          applicationStatus={callbacks.getApplicationStatus?.(doc.id)}
          onApplicationStatusChange={(status) =>
            callbacks.onUpdateApplicationStatus?.(doc.id, status)
          }
          onViewInPipeline={callbacks.onViewInPipeline}
          superseded={block.superseded}
        />
      );
    }
    case "error":
      return (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{block.message}</span>
        </div>
      );
    case "success":
      return (
        <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{block.message}</span>
        </div>
      );
  }
}
