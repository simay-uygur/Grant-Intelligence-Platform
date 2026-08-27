import { useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  Coins,
  ExternalLink,
  MessagesSquare,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Grant } from "@/types";
import { MOCK_GRANTS } from "@/data/mockGrants";
import { useShortlist, type SavedGrant } from "@/hooks/useShortlist";
import { formatDeadline } from "@/utils/deadline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeadlineBadge } from "@/components/grants/DeadlineBadge";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

/**
 * Detail sheet for a saved grant — shows the full record including the
 * complete "why it matches" text, funding details, deadline, and source link.
 */
function SavedGrantDetailsSheet({
  saved,
  open,
  onOpenChange,
  onRemove,
}: {
  saved: SavedGrant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
}) {
  const matchPct = saved?.matchPercentage ?? saved?.grant?.matchPercentage;
  const whyItMatches = saved?.whyItMatches ?? saved?.grant?.whyItMatches;
  const matchReasons = saved?.matchReasons ?? saved?.grant?.matchReasons;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        {saved && (
          <>
            <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[11px] font-medium uppercase tracking-wider text-brand">
                  {saved.programme}
                </div>
                {Boolean(matchPct) && (
                  <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                    ★ {matchPct}% Match
                  </span>
                )}
              </div>
              <SheetTitle className="text-base leading-snug">{saved.title}</SheetTitle>
              <SheetDescription className="sr-only">
                Full details for the saved grant: {saved.title}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5 text-sm">
                {/* Funding & deadline */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Funding &amp; deadline
                  </h3>
                  <dl className="mt-2 space-y-3">
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Amount</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground">
                        <Coins className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {saved.fundingAmount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Deadline</dt>
                      <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-foreground">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{formatDeadline(saved.deadline)}</span>
                        <DeadlineBadge deadline={saved.deadline} />
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Why it matches */}
                {(whyItMatches || matchReasons?.length) && (
                  <section className="border-t border-border pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Why it matches
                    </h3>
                    <div className="mt-2 space-y-3">
                      {whyItMatches && (
                        <p className="whitespace-pre-wrap break-words text-sm italic text-foreground/80 [overflow-wrap:anywhere]">
                          &ldquo;{whyItMatches}&rdquo;
                        </p>
                      )}
                      {matchReasons?.length ? (
                        <ul className="space-y-1">
                          {matchReasons.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{reason}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </section>
                )}

                {/* Saved metadata */}
                <section className="border-t border-border pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Saved info
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Saved {formatDistanceToNow(new Date(saved.savedAt), { addSuffix: true })}
                  </p>
                </section>

                {/* Tags from the full grant object if available */}
                {saved.grant?.tags?.length ? (
                  <div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
                    {saved.grant.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <SheetFooter className="shrink-0 flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-start sm:space-x-0">
              {saved.sourceUrl.trim() && (
                <Button asChild variant="outline" className="w-full rounded-lg hover:bg-muted sm:w-auto">
                  <a
                    href={saved.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open official source for ${saved.title} (opens in a new tab)`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open official source
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onRemove();
                }}
                className="w-full rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
              >
                <BookmarkCheck className="h-3.5 w-3.5" />
                Remove from saved
              </Button>
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-lg hover:bg-muted sm:ml-auto sm:w-auto"
                >
                  Close
                </Button>
              </SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SavedGrantCard({
  saved,
  onRemove,
  onOpenDetails,
}: {
  saved: SavedGrant;
  onRemove: () => void;
  onOpenDetails: () => void;
}) {
  const matchPct = saved.matchPercentage ?? saved.grant?.matchPercentage;
  const whyItMatches = saved.whyItMatches ?? saved.grant?.whyItMatches;

  return (
    // `relative` anchors the title button's stretched hit area. The card
    // is interactive: clicking anywhere opens the detail sheet.
    <article
      className="relative flex h-full flex-col rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-brand/20 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="break-words text-[11px] font-medium text-brand [overflow-wrap:anywhere]">
              {saved.programme}
            </div>
            {Boolean(matchPct) && (
              <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                ★ {matchPct}% Match
              </span>
            )}
          </div>
          {/* The title button stretches its hit area across the whole card */}
          <h3 className="mt-1 break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">
            <button
              type="button"
              onClick={onOpenDetails}
              aria-label={`View full details for ${saved.title}`}
              className="rounded-sm text-left underline-offset-2 after:absolute after:inset-0 after:rounded-2xl hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {saved.title}
            </button>
          </h3>
        </div>
        {/* Bookmark button lifted above the card overlay */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-pressed={true}
          aria-label={`Remove ${saved.title} from saved grants`}
          className="relative z-10 h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted"
        >
          <BookmarkCheck className="h-4 w-4 text-brand" />
        </Button>
      </div>

      {whyItMatches && (
        <div className="mt-2 max-h-20 overflow-y-auto rounded-lg bg-brand/[0.04] p-2 scrollbar-thin">
          <p className="text-xs font-medium text-foreground/80 italic">
            &ldquo;{whyItMatches}&rdquo;
          </p>
        </div>
      )}

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
        {/* z-10 so the external link sits above the card's overlay */}
        <div className="relative z-10">
          {saved.sourceUrl.trim() ? (
            <Button asChild variant="outline" size="sm" className="rounded-lg hover:bg-muted">
              <a
                href={saved.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open source page for ${saved.title} (opens in a new tab)`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open source
              </a>
            </Button>
          ) : (
            <button
              type="button"
              onClick={onOpenDetails}
              className="relative z-10 text-[11px] font-medium text-brand underline-offset-2 hover:underline"
            >
              View details →
            </button>
          )}
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
  const [searchQuery, setSearchQuery] = useState("");
  // The id of the grant whose details sheet is open. Kept after close so the
  // sheet can still render while it slides out (same pattern as Pipeline).
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const detailGrant = savedGrants.find((g) => g.id === detailId) ?? null;

  const filteredGrants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return savedGrants;
    return savedGrants.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.programme.toLowerCase().includes(q) ||
        g.fundingAmount.toLowerCase().includes(q) ||
        (g.whyItMatches && g.whyItMatches.toLowerCase().includes(q)),
    );
  }, [savedGrants, searchQuery]);

  return (
    <section aria-labelledby="saved-heading" className="w-full px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="saved-heading" className="text-lg font-semibold text-foreground">
            Saved grants
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Grants you&apos;ve bookmarked while researching, newest first. Saved here as their own
            record, so they stay even if you delete the conversation that found them.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search saved grants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
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
      ) : filteredGrants.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">No matching saved grants found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search query &ldquo;{searchQuery}&rdquo;.
          </p>
        </div>
      ) : (
        <ul role="list" className="grid gap-4 lg:grid-cols-2">
          {filteredGrants.map((saved) => (
            <li key={saved.id}>
              <SavedGrantCard
                saved={saved}
                onRemove={() => toggleSave(grantForRemoval(saved))}
                onOpenDetails={() => {
                  setDetailId(saved.id);
                  setDetailOpen(true);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <SavedGrantDetailsSheet
        saved={detailGrant}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRemove={() => {
          if (detailGrant) toggleSave(grantForRemoval(detailGrant));
        }}
      />
    </section>
  );
}
