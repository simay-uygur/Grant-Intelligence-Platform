import { useState } from "react";
import { Bookmark, BookmarkX, ExternalLink, MessagesSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Grant } from "@/types";
import { MOCK_GRANTS } from "@/data/mockGrants";
import { useShortlist, type SavedGrant } from "@/hooks/useShortlist";
import { formatDeadline } from "@/utils/deadline";
import { Button } from "@/components/ui/button";
import { DeadlineBadge } from "@/components/grants/DeadlineBadge";
import { MetaCell } from "@/components/grants/GrantResults";
import { GrantDetailsSheet } from "@/components/grants/GrantDetailsSheet";
import { EmptyState } from "@/components/EmptyState";

/**
 * Convert a SavedGrant into a displayable Grant for the details sheet.
 */
function savedToFullGrant(saved: SavedGrant): Grant {
  const catalogue = MOCK_GRANTS.find(
    (g) => g.id === saved.id || g.title.toLowerCase() === saved.title.toLowerCase(),
  );
  if (catalogue) return catalogue;
  return {
    id: saved.id,
    programme: saved.programme || "Horizon Europe",
    title: saved.title,
    fundingAmount: saved.fundingAmount || "Horizon Europe standard rates",
    deadline: saved.deadline,
    sourceUrl:
      saved.sourceUrl ||
      "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/programmes/horizon",
    matchPercentage: 90,
    eligibleCountries: [
      "EU Member States",
      "Horizon Europe Associated Countries",
    ],
    organisationEligibility: [
      "SMEs and Startups",
      "Universities & Research Organisations",
      "Public Bodies and Large Enterprises",
    ],
    fundingType: "Grant (100% research / 70% innovation)",
    description: `${saved.title} — Strategic European Commission research and innovation action under ${saved.programme || "Horizon Europe"}.`,
    whyItMatches:
      "Aligns strongly with EU innovation priorities, research call scope, and your organisation profile.",
    matchReasons: [
      "Target topic matches European research and technology roadmap",
      "Consortium participation eligible for European innovators and research bodies",
      "Funding instrument covers development, prototyping, and cross-border validation",
    ],
    requirements: [
      "Consortium of minimum 3 independent legal entities from 3 different EU/Associated countries",
      "Detailed work package breakdown, deliverables schedule, and risk management plan",
      "Adherence to open access and FAIR data principles",
    ],
    tags: ["Horizon Europe", "Innovation", "EU Grant"],
  };
}

function SavedGrantCard({
  saved,
  onRemove,
  onStartApplication,
  onViewDetails,
}: {
  saved: SavedGrant;
  onRemove: () => void;
  onStartApplication: () => void;
  onViewDetails: () => void;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="min-w-0">
        <div className="break-words text-[11px] font-medium uppercase tracking-wider text-brand [overflow-wrap:anywhere]">
          {saved.programme}
        </div>
        <h3 className="mt-1.5 break-words text-lg font-bold leading-snug [overflow-wrap:anywhere]">
          <button
            type="button"
            onClick={onViewDetails}
            className="text-left font-bold text-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {saved.title}
          </button>
        </h3>
      </div>

      <dl className="mt-4 grid grid-cols-2 divide-x divide-border rounded-lg border border-border">
        <MetaCell label="Funding" value={saved.fundingAmount} />
        <MetaCell
          label="Deadline"
          value={formatDeadline(saved.deadline)}
          badge={<DeadlineBadge deadline={saved.deadline} compact />}
        />
      </dl>

      <div className="flex-1" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          Saved {formatDistanceToNow(new Date(saved.savedAt), { addSuffix: true })}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {saved.sourceUrl.trim() && (
            <Button asChild variant="outline" size="sm" className="rounded-lg hover:bg-muted">
              <a
                href={saved.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open source page for ${saved.title} (opens in a new tab)`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open source
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRemove}
            aria-label={`Remove ${saved.title} from saved grants`}
            className="rounded-lg hover:bg-muted"
          >
            <BookmarkX className="h-3.5 w-3.5" />
            Remove
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onStartApplication}
            aria-label={`Start an application for ${saved.title}`}
            className="rounded-lg bg-brand text-brand-foreground shadow-sm hover:bg-brand/90"
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            Start application
          </Button>
        </div>
      </div>
    </article>
  );
}

export function SavedGrants({
  onGoToChat,
  onStartApplication,
}: {
  onGoToChat: () => void;
  onStartApplication?: (grant: Grant) => void;
}) {
  const { savedGrants, toggleSave, hydrated } = useShortlist();
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);

  const handleStart = (grant: Grant) => {
    setSelectedGrant(null);
    if (onStartApplication) {
      onStartApplication(grant);
    } else {
      onGoToChat();
    }
  };

  return (
    <section aria-labelledby="saved-heading" className="w-full px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h2 id="saved-heading" className="text-lg font-semibold text-foreground">
          Saved grants
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Grants you&apos;ve bookmarked while researching, newest first. Click any grant title to view its full specification.
        </p>
      </header>

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Loading saved grants…</p>
      ) : savedGrants.length === 0 ? (
        <EmptyState
          headingLevel="h3"
          icon={Bookmark}
          title="No saved grants yet"
          description="Bookmark a grant from your research results and it will be kept here with its funder, funding range and deadline — so you can come back to it without scrolling through the conversation."
          action={{ label: "Find grants in chat", onClick: onGoToChat, icon: MessagesSquare }}
        />
      ) : (
        <ul role="list" className="grid gap-4 lg:grid-cols-2">
          {savedGrants.map((saved) => (
            <li key={saved.id}>
              <SavedGrantCard
                saved={saved}
                onRemove={() => toggleSave(savedToFullGrant(saved))}
                onStartApplication={() => handleStart(savedToFullGrant(saved))}
                onViewDetails={() => setSelectedGrant(savedToFullGrant(saved))}
              />
            </li>
          ))}
        </ul>
      )}

      <GrantDetailsSheet
        grant={selectedGrant}
        open={!!selectedGrant}
        onOpenChange={(open) => {
          if (!open) setSelectedGrant(null);
        }}
        onAsk={() => {
          setSelectedGrant(null);
          onGoToChat();
        }}
        onStart={(grant) => {
          handleStart(grant);
        }}
      />
    </section>
  );
}
