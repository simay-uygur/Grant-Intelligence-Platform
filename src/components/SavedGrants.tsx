import { Bookmark, BookmarkX, ExternalLink, MessagesSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Grant } from "@/types";
import { MOCK_GRANTS } from "@/data/mockGrants";
import { useShortlist, type SavedGrant } from "@/hooks/useShortlist";
import { formatDeadline } from "@/utils/deadline";
import { Button } from "@/components/ui/button";
import { DeadlineBadge } from "@/components/grants/DeadlineBadge";
import { MetaCell } from "@/components/grants/GrantResults";
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

function SavedGrantCard({
  saved,
  onRemove,
  onGoToChat,
}: {
  saved: SavedGrant;
  onRemove: () => void;
  onGoToChat: () => void;
}) {
  return (
    // Same shell + ruled-meta-row language as the grant cards in the results
    // list (see GrantResults.tsx), so a saved grant reads as the same object
    // in a different place. Only shows what the snapshot actually stores —
    // no match score, funder description, or eligibility, since those were
    // never saved alongside it (see useShortlist's SavedGrant).
    <article className="flex h-full flex-col rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="min-w-0">
        <div className="break-words text-[11px] font-medium uppercase tracking-wider text-brand [overflow-wrap:anywhere]">
          {saved.programme}
        </div>
        <h3 className="mt-1.5 break-words text-lg font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
          {saved.title}
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
          {/* Starting an application needs an organisation profile, which
              lives on whichever conversation is active in chat — this view
              spans every conversation and has none of its own, so there's no
              honest profile to attach a new application to from here. This
              routes to where starting one for real is actually possible,
              rather than silently no-oping or guessing a profile. */}
          <Button
            type="button"
            size="sm"
            onClick={onGoToChat}
            aria-label={`Open chat to start an application for ${saved.title}`}
            className="rounded-lg bg-brand text-brand-foreground shadow-sm hover:bg-brand/90"
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            Open in chat to apply
          </Button>
        </div>
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
        <p className="mt-2">
          <DemoBadge marker="demo-data" />
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
              <SavedGrantCard
                saved={saved}
                onRemove={() => toggleSave(grantForRemoval(saved))}
                onGoToChat={onGoToChat}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
