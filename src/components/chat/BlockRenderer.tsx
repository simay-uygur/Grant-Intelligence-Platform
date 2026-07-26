import type {
  ApplicationDocument,
  ChatBlock,
  Grant,
  OrganisationProfile,
} from "@/types";
import { OrganisationForm } from "@/components/widgets/OrganisationForm";
import { ResearchStatus } from "@/components/widgets/ResearchStatus";
import { GrantResults } from "@/components/grants/GrantResults";
import { ApplicationDocumentView } from "@/components/documents/ApplicationDocument";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface BlockCallbacks {
  onSubmitProfile: (profile: OrganisationProfile) => void;
  onRetryResearch: () => void;
  onAskGrant: (grant: Grant) => void;
  onStartApplication: (grant: Grant) => void;
  onSectionChange: (sectionId: string, content: string) => void;
  getDocument: (id: string) => ApplicationDocument | undefined;
  getProfile: () => OrganisationProfile | undefined;
  getGrantById: (id: string) => Grant | undefined;
  formDisabled?: boolean;
}

export function BlockRenderer({
  block,
  callbacks,
}: {
  block: ChatBlock;
  callbacks: BlockCallbacks;
}) {
  switch (block.type) {
    case "text":
      return (
        <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
          {block.text}
        </p>
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
          initial={block.profile}
          disabled={callbacks.formDisabled}
          onSubmit={callbacks.onSubmitProfile}
        />
      );
    case "research_status":
      return (
        <ResearchStatus
          state={block.state}
          onRetry={block.state.error ? callbacks.onRetryResearch : undefined}
        />
      );
    case "grant_results":
      return (
        <GrantResults
          grants={block.grants}
          onAsk={callbacks.onAskGrant}
          onStart={callbacks.onStartApplication}
        />
      );
    case "document": {
      const doc = callbacks.getDocument(block.documentId);
      if (!doc) return null;
      const grant = callbacks.getGrantById(doc.grantId);
      return (
        <ApplicationDocumentView
          doc={doc}
          profile={callbacks.getProfile()}
          grant={grant}
          onSectionChange={callbacks.onSectionChange}
        />
      );
    }
    case "error":
      return (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            {block.message}
          </span>
        </div>
      );
    case "success":
      return (
        <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            {block.message}
          </span>
        </div>
      );
  }
}
