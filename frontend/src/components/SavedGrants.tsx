import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ChevronRight,
  Coins,
  ExternalLink,
  MessagesSquare,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Grant } from "@/types";
import { MOCK_GRANTS } from "@/data/mockGrants";
import { useShortlist, type SavedGrant } from "@/hooks/useShortlist";
import { formatDeadline } from "@/utils/deadline";
import { getGrantSourceType } from "@/components/grants/grantPresentation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeadlineBadge } from "@/components/grants/DeadlineBadge";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type SavedSortOption = "newest" | "match_desc" | "deadline_asc" | "title_asc";
export type SavedSourceFilter = "all" | "eu_portal" | "web_discovery";
export type SavedMatchFilter = "all" | "80" | "70";

/**
 * toggleSave takes a full Grant, because SAVING needs the whole record. This
 * view only ever REMOVES an already-saved grant, and that path reads nothing
 * but `id` — so the remaining fields are never stored. The real catalogue
 * entry is used when it exists; the fallback exists so a saved grant whose
 * catalogue entry has gone can still be un-saved rather than being stuck.
 */
function grantForRemoval(saved: SavedGrant): Grant {
  const match = MOCK_GRANTS.find((g) => g.id === saved.id);
  if (match) return match;
  return {
    id: saved.id,
    title: saved.title,
    deadline: saved.deadline,
    fundingAmount: saved.fundingAmount,
    programme: saved.programme,
    description: "",
    sourceUrl: saved.sourceUrl,
    matchPercentage: saved.matchPercentage,
    whyItMatches: saved.whyItMatches,
  };
}

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
  if (!saved) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{saved.programme}</span>
            {saved.matchPercentage !== undefined && (
              <span className="font-semibold text-brand">★ {saved.matchPercentage}% match</span>
            )}
          </div>
          <SheetTitle className="text-left text-lg font-bold">{saved.title}</SheetTitle>
          <SheetDescription className="sr-only">
            Full details and bookmarked metadata for {saved.title}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 text-sm">
          {saved.whyItMatches && (
            <div className="rounded-xl border border-brand/15 bg-brand/[0.04] p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                <Sparkles className="h-4 w-4" />
                Match summary
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground/80 italic">
                &ldquo;{saved.whyItMatches}&rdquo;
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 rounded-xl border p-4 text-xs">
            <div>
              <div className="text-muted-foreground">Funding amount</div>
              <div className="mt-1 font-semibold text-foreground">{saved.fundingAmount}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Deadline</div>
              <div className="mt-1 font-semibold text-foreground">
                {formatDeadline(saved.deadline)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Bookmarked</div>
              <div className="mt-1 text-foreground">
                {formatDistanceToNow(new Date(saved.savedAt), { addSuffix: true })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Source</div>
              <div className="mt-1 text-foreground">
                {getGrantSourceType(saved.grant ?? grantForRemoval(saved)) === "web_discovery"
                  ? "Web Discovery"
                  : "EU Funding & Tenders Portal"}
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-8 flex flex-row items-center justify-between gap-3 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onRemove();
              onOpenChange(false);
            }}
            className="text-destructive hover:bg-destructive/10"
          >
            Remove from saved
          </Button>
          <div className="flex items-center gap-2">
            {saved.sourceUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={saved.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Official portal
                </a>
              </Button>
            )}
            <SheetClose asChild>
              <Button variant="secondary" size="sm">
                Done
              </Button>
            </SheetClose>
          </div>
        </SheetFooter>
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
  const [whyExpanded, setWhyExpanded] = useState(false);
  const matchPct = saved.matchPercentage ?? saved.grant?.matchPercentage;
  const whyItMatches = saved.whyItMatches ?? saved.grant?.whyItMatches;
  const sourceType = getGrantSourceType(saved.grant ?? grantForRemoval(saved));

  return (
    <article className="relative flex h-full flex-col justify-between rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-brand/20 sm:p-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                  sourceType === "web_discovery"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                )}
              >
                {sourceType === "web_discovery" ? "🌐 Web Discovery" : "🇪🇺 EU Portal"}
              </span>
              <div className="break-words text-[11px] font-medium text-muted-foreground [overflow-wrap:anywhere]">
                {saved.programme}
              </div>
              {Boolean(matchPct) && (
                <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                  ★ {matchPct}% Match
                </span>
              )}
            </div>
            <h3 className="mt-0.5 break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">
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
          <div
            className="relative z-10 mt-2.5 rounded-lg border border-brand/10 bg-brand/[0.03] p-2.5 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-brand">
                <Sparkles className="h-3 w-3" />
                Why it matches
              </div>
              {whyItMatches.length > 90 && (
                <button
                  type="button"
                  onClick={() => setWhyExpanded(!whyExpanded)}
                  className="inline-flex items-center gap-0.5 text-[10px] font-medium text-brand hover:underline cursor-pointer"
                >
                  <span>{whyExpanded ? "Show less" : "More info"}</span>
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      whyExpanded && "rotate-90",
                    )}
                  />
                </button>
              )}
            </div>
            <p
              className={cn(
                "mt-1 text-[11.5px] leading-relaxed text-foreground/80 italic [overflow-wrap:anywhere]",
                !whyExpanded && "line-clamp-2",
              )}
            >
              &ldquo;{whyItMatches}&rdquo;
            </p>
          </div>
        )}

        <dl className="mt-3.5 space-y-1.5 text-xs text-muted-foreground">
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
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          Saved {formatDistanceToNow(new Date(saved.savedAt), { addSuffix: true })}
        </span>
        <div className="relative z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails();
            }}
            className="text-[11px] font-medium text-brand underline-offset-2 hover:underline px-1.5 py-1"
          >
            More info →
          </button>
          {saved.sourceUrl.trim() && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 rounded-lg hover:bg-muted text-xs px-2"
            >
              <a
                href={saved.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open source page for ${saved.title} (opens in a new tab)`}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open source
              </a>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function SavedGrants({ onGoToChat }: { onGoToChat: () => void }) {
  const { savedGrants, toggleSave, hydrated } = useShortlist();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SavedSortOption>("newest");
  const [sourceFilter, setSourceFilter] = useState<SavedSourceFilter>("all");
  const [minMatchFilter, setMinMatchFilter] = useState<SavedMatchFilter>("all");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const detailGrant = savedGrants.find((g) => g.id === detailId) ?? null;

  const isFiltered =
    searchQuery.trim() !== "" ||
    sourceFilter !== "all" ||
    minMatchFilter !== "all" ||
    sortBy !== "newest";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSortBy("newest");
    setSourceFilter("all");
    setMinMatchFilter("all");
  };

  const filteredGrants = useMemo(() => {
    let list = [...savedGrants];

    // 1. Keyword search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.programme.toLowerCase().includes(q) ||
          g.fundingAmount.toLowerCase().includes(q) ||
          (g.whyItMatches && g.whyItMatches.toLowerCase().includes(q)),
      );
    }

    // 2. Source filter
    if (sourceFilter !== "all") {
      list = list.filter((g) => {
        const type = getGrantSourceType(g.grant ?? grantForRemoval(g));
        return type === sourceFilter;
      });
    }

    // 3. Min match filter
    if (minMatchFilter === "80") {
      list = list.filter((g) => {
        const pct = g.matchPercentage ?? g.grant?.matchPercentage ?? 0;
        return pct >= 80;
      });
    } else if (minMatchFilter === "70") {
      list = list.filter((g) => {
        const pct = g.matchPercentage ?? g.grant?.matchPercentage ?? 0;
        return pct >= 70;
      });
    }

    // 4. Sort
    list.sort((a, b) => {
      if (sortBy === "match_desc") {
        const pctA = a.matchPercentage ?? a.grant?.matchPercentage ?? 0;
        const pctB = b.matchPercentage ?? b.grant?.matchPercentage ?? 0;
        return pctB - pctA;
      }
      if (sortBy === "deadline_asc") {
        const timeA = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      }
      if (sortBy === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      // Default: newest saved first
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });

    return list;
  }, [savedGrants, searchQuery, sourceFilter, minMatchFilter, sortBy]);

  return (
    <section aria-labelledby="saved-heading" className="w-full px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="saved-heading" className="text-lg font-semibold text-foreground">
              Saved grants
            </h2>
            {savedGrants.length > 0 && (
              <span
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums"
                aria-label={`${savedGrants.length} saved grants`}
              >
                {savedGrants.length}
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Grants you&apos;ve bookmarked while researching, newest first. Saved here as their own
            record, so they stay even if you delete the conversation that found them.
          </p>
        </div>
      </header>

      {/* Toolbar: Search, Filters & Sorting */}
      {savedGrants.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3.5 shadow-xs">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search saved grants by title, topic, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 text-xs h-9 bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search query"
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter & Sort Selects */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Source Filter */}
              <div className="w-40 sm:w-44">
                <Select
                  value={sourceFilter}
                  onValueChange={(val) => setSourceFilter(val as SavedSourceFilter)}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All sources
                    </SelectItem>
                    <SelectItem value="eu_portal" className="text-xs">
                      🇪🇺 EU Portal only
                    </SelectItem>
                    <SelectItem value="web_discovery" className="text-xs">
                      🌐 Web Discovery only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Match Filter */}
              <div className="w-36 sm:w-40">
                <Select
                  value={minMatchFilter}
                  onValueChange={(val) => setMinMatchFilter(val as SavedMatchFilter)}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Match %" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All matches
                    </SelectItem>
                    <SelectItem value="80" className="text-xs">
                      ★ 80%+ Match
                    </SelectItem>
                    <SelectItem value="70" className="text-xs">
                      ★ 70%+ Match
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div className="w-40 sm:w-44">
                <Select value={sortBy} onValueChange={(val) => setSortBy(val as SavedSortOption)}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <div className="flex items-center gap-1.5 truncate">
                      <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <SelectValue placeholder="Sort by" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest" className="text-xs">
                      Recently saved
                    </SelectItem>
                    <SelectItem value="match_desc" className="text-xs">
                      Highest match %
                    </SelectItem>
                    <SelectItem value="deadline_asc" className="text-xs">
                      Nearest deadline
                    </SelectItem>
                    <SelectItem value="title_asc" className="text-xs">
                      Title (A–Z)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset button if active filters */}
              {isFiltered && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground px-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Filter Status Summary */}
          {isFiltered && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-2 px-0.5">
              <span>
                Showing <strong className="text-foreground">{filteredGrants.length}</strong> of{" "}
                {savedGrants.length} saved grants
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-brand hover:underline font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

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
      ) : filteredGrants.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">No matching saved grants found</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting your search keywords, source filter, or match threshold.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="text-xs gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset all filters
          </Button>
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
