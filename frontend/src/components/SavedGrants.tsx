import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  Coins,
  ExternalLink,
  MessagesSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Grant } from "@/types";
import { MOCK_GRANTS } from "@/data/mockGrants";
import { useShortlist, type SavedGrant } from "@/hooks/useShortlist";
import { formatDeadline } from "@/utils/deadline";
import { Button } from "@/components/ui/button";
import { DeadlineBadge } from "@/components/grants/DeadlineBadge";
import { DemoBadge } from "@/components/common/DemoBadge";
import { EmptyState } from "@/components/EmptyState";

/**
 * toggleSave takes a full Grant, because SAVING needs the whole record. This
 * view only ever REMOVES an already-saved grant, and that path reads nothing
 * but `id` — so the remaining fields are never stored. The real catalogue
 * entry is used when it exists; the fallback exists so a saved grant whose
 * catalogue entry has gone can still be un-saved rather than being stuck.
 */
function grantForRemoval(saved: SavedGrant): Grant {
  const catalogue = MOCK_GRANTS.find((g) => g.id === saved.id);
  if (catalogue) return catalogue;
  return {
    id: saved.id,
    programme: saved.programme,
    title: saved.title,
    fundingAmount: saved.fundingAmount,
    deadline: saved.deadline,
    sourceUrl: saved.sourceUrl,
    matchPercentage: 0,
    eligibleCountries: [],
    organisationEligibility: [],
    fundingType: "",
    description: "",
    whyItMatches: "",
    matchReasons: [],
    requirements: [],
    tags: [],
  };
}

function SavedGrantCard({ saved, onRemove }: { saved: SavedGrant; onRemove: () => void }) {
  return (
    // Same shell as the grant cards in the results list, so a saved grant
    // reads as the same object in a different place.
    <article className="flex h-full flex-col rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="break-words text-[11px] font-medium text-brand [overflow-wrap:anywhere]">
            {saved.programme}
          </div>
          <h3 className="mt-1 break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">
            {saved.title}
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-pressed={true}
          aria-label={`Remove ${saved.title} from saved grants`}
          className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted"
        >
          <BookmarkCheck className="h-4 w-4 text-brand" />
        </Button>
      </div>

      <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Funding</dt>
          <dd className="min-w-0 break-words text-foreground">{saved.fundingAmount}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Deadline</dt>
          <dd>{formatDeadline(saved.deadline)}</dd>
          <DeadlineBadge deadline={saved.deadline} compact />
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          Saved {formatDistanceToNow(new Date(saved.savedAt), { addSuffix: true })}
        </span>
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
      </div>
    </article>
  );
}

/**
 * Every grant the user has bookmarked, in one place — a sibling main view of
 * the chat and the pipeline, not a chat block, since a shortlist spans
 * conversations.
 *
 * Safe to call useShortlist here alongside the copy inside GrantResults: that
 * hook writes on mutation and broadcasts to every mounted instance, so
 * un-saving here clears the bookmark on a grant card and vice versa.
 */
export function SavedGrants({ onGoToChat }: { onGoToChat: () => void }) {
  const { savedGrants, toggleSave, hydrated } = useShortlist();

  return (
    <section aria-labelledby="saved-heading" className="w-full px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h2 id="saved-heading" className="text-lg font-semibold text-foreground">
          Saved grants
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Grants you&apos;ve bookmarked while researching, newest first. Saved here as their own
          record, so they stay even if you delete the conversation that found them.
        </p>
      </header>

      {!hydrated ? (
        // Read from storage in an effect, so the first render has nothing yet;
        // showing the empty state here would wrongly claim nothing is saved.
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
              <SavedGrantCard saved={saved} onRemove={() => toggleSave(grantForRemoval(saved))} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
