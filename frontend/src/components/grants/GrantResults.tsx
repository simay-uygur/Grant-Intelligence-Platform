import { useMemo, useState, type ReactNode } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  ExternalLink,
  Globe2,
  MessageSquare,
  RefreshCw,
  Scale,
  SearchX,
  Sparkles,
} from "lucide-react";
import type { Grant } from "@/types";
import { cn } from "@/lib/utils";
import { CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GrantDetailsSheet } from "./GrantDetailsSheet";
import { DeadlineBadge } from "./DeadlineBadge";
import { EmptyState } from "@/components/EmptyState";
import { useShortlist } from "@/hooks/useShortlist";
import {
  MATCH_TIER_CLASSES,
  type MatchTier,
  matchTierFor,
  getGrantSourceType,
} from "./grantPresentation";
import { formatDeadline } from "@/utils/deadline";

interface Props {
  grants: Grant[];
  allCandidates?: Grant[];
  sourceSummary?: string;
  onAsk: (grant: Grant) => void;
  onStart: (grant: Grant) => void;
  /** Re-runs the search from the stored profile; absent if there's nothing to retry from. */
  onRetryResearch?: () => void;
  /** True while a start is already in flight, so it can't be fired twice. */
  startDisabled?: boolean;
  startingGrantId?: string | null;
  existingGrantIds?: Set<string>;
}

const MAX_COMPARE = 3;

export function GrantResults({
  grants,
  allCandidates,
  sourceSummary,
  onAsk,
  onStart,
  onRetryResearch,
  startDisabled,
}: Props) {
  // Saved grants are durable (gi.shortlist.v1) and shared across every
  // GrantResults on screen; compare below stays deliberately ephemeral.
  const { isSaved, toggleSave } = useShortlist();
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState<"all" | "eu_portal" | "web_discovery">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const candidatePool = useMemo(() => {
    if (allCandidates && allCandidates.length > 0) return allCandidates;
    return grants;
  }, [allCandidates, grants]);

  const euCount = useMemo(
    () => candidatePool.filter((c) => getGrantSourceType(c) === "eu_portal").length,
    [candidatePool],
  );
  const webCount = useMemo(
    () => candidatePool.filter((c) => getGrantSourceType(c) === "web_discovery").length,
    [candidatePool],
  );

  const filteredCandidates = useMemo(() => {
    return candidatePool.filter((candidate) => {
      const type = getGrantSourceType(candidate);
      if (candidateFilter === "eu_portal" && type !== "eu_portal") return false;
      if (candidateFilter === "web_discovery" && type !== "web_discovery") return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        candidate.title.toLowerCase().includes(q) ||
        (candidate.description || "").toLowerCase().includes(q) ||
        (candidate.programme || "").toLowerCase().includes(q)
      );
    });
  }, [candidatePool, candidateFilter, searchQuery]);

  const openDetails = (grant: Grant) => {
    setSelectedGrant(grant);
    setDetailsOpen(true);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_COMPARE) next.add(id);
      return next;
    });
  };

  const compareGrants = useMemo(
    () => grants.filter((g) => compareIds.has(g.id)),
    [grants, compareIds],
  );
  const candidatesExpanded = grants.length === 0 || showAllCandidates;

  // Zero matches is a real outcome for a real grant-seeker, not an edge case:
  // it needs to say what to change next, not just report the absence. Reachable
  // via ?mock=search-empty (see services/mockScenario.ts).
  if (grants.length === 0 && candidatePool.length === 0) {
    return (
      <EmptyState
        headingLevel="h3"
        icon={SearchX}
        title="No grants matched this profile"
        description="No grant opportunities matched all of the specified criteria. Widening the funding range, allowing a longer project duration, or relaxing country constraints usually opens up additional calls."
        action={
          onRetryResearch
            ? { label: "Search again", onClick: onRetryResearch, icon: RefreshCw }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {grants.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Top {grants.length} matched grant{grants.length === 1 ? "" : "s"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Ranked by fit with your organisation profile.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <h3 className="text-sm font-semibold text-foreground">
            No strong recommendations selected
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The search found source opportunities, but none cleared every fit criterion for a
            recommendation. Review the discovered opportunities below or widen the profile and
            search again.
          </p>
          {onRetryResearch && (
            <Button type="button" size="sm" onClick={onRetryResearch} className="mt-3 rounded-lg">
              <RefreshCw className="h-3.5 w-3.5" />
              Search again
            </Button>
          )}
        </div>
      )}

      {grants.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {grants.map((g) => (
            <GrantCard
              key={g.id}
              grant={g}
              onAsk={onAsk}
              onStart={onStart}
              onViewDetails={openDetails}
              saved={isSaved(g.id)}
              onToggleSaved={() => toggleSave(g)}
              compareChecked={compareIds.has(g.id)}
              onToggleCompare={() => toggleCompare(g.id)}
              compareDisabled={!compareIds.has(g.id) && compareIds.size >= MAX_COMPARE}
              startDisabled={startDisabled}
            />
          ))}
        </div>
      )}

      {candidatePool.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => {
              if (grants.length > 0) setShowAllCandidates((prev) => !prev);
            }}
            aria-expanded={candidatesExpanded}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/10 text-brand">
                <Globe2 className="h-3.5 w-3.5" />
              </span>
              <div>
                <span className="font-semibold text-xs sm:text-sm text-foreground">
                  All Discovered Opportunities & Web Sources
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
              <span>
                {grants.length === 0
                  ? "Candidate list"
                  : candidatesExpanded
                    ? "Hide list"
                    : "Show all"}
              </span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  candidatesExpanded && "rotate-90",
                )}
              />
            </div>
          </button>

          {candidatesExpanded && (
            <div className="border-t border-border px-4 py-3.5 space-y-3 bg-muted/10">
              {sourceSummary && (
                <p className="text-[11px] text-muted-foreground">{sourceSummary}</p>
              )}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                {/* Source Filter Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    variant={candidateFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCandidateFilter("all")}
                    className="h-7 text-xs rounded-full px-2.5"
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant={candidateFilter === "eu_portal" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCandidateFilter("eu_portal")}
                    className="h-7 text-xs rounded-full px-2.5 gap-1"
                  >
                    EU Portal ({euCount})
                  </Button>
                  <Button
                    type="button"
                    variant={candidateFilter === "web_discovery" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCandidateFilter("web_discovery")}
                    className="h-7 text-xs rounded-full px-2.5 gap-1"
                  >
                    Web Discovery ({webCount})
                  </Button>
                </div>

                {/* Search query input */}
                {candidatePool.length > 3 && (
                  <input
                    type="text"
                    placeholder="Filter by title / topic…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 w-full sm:w-44 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                )}
              </div>

              {/* Candidates List */}
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {filteredCandidates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No discovered opportunities matched your filter.
                  </div>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <CandidateItem
                      key={candidate.id}
                      grant={candidate}
                      onAsk={onAsk}
                      onViewDetails={openDetails}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Appears as soon as one grant is checked, not just at two — a user
          who checks a single box and sees nothing happen has no way to know
          the feature exists. Static (not sticky): it sits right after the
          grid rather than trailing behind scroll position in a block that's
          embedded partway down a long chat transcript. */}
      {grants.length > 0 && compareIds.size >= 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {compareIds.size === 1
              ? "1 grant selected — choose 1 more to compare."
              : `${compareIds.size} grants selected for comparison.`}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => setCompareOpen(true)}
            disabled={compareIds.size < 2}
            className="rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90"
          >
            <Scale className="h-3.5 w-3.5" />
            {compareIds.size >= 2 ? `Compare ${compareIds.size} grants` : "Compare"}
          </Button>
        </div>
      )}

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compare grants</DialogTitle>
            <DialogDescription>
              A quick side-by-side of the grants you selected. This comparison is local to this
              screen only — nothing is saved.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Grant</th>
                  {compareGrants.map((g) => (
                    <th key={g.id} className="max-w-[160px] py-2 pr-3 font-medium text-foreground">
                      <span className="line-clamp-2">{g.title}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="Match score"
                  values={compareGrants.map((g) => `${g.matchPercentage ?? 0}%`)}
                />
                <CompareRow
                  label="Funding"
                  values={compareGrants.map((g) => g.fundingAmount || "—")}
                />
                <CompareRow
                  label="Deadline"
                  values={compareGrants.map((g) => (g.deadline ? formatDeadline(g.deadline) : "—"))}
                />
                <CompareRow
                  label="Eligible countries"
                  values={compareGrants.map((g) => (g.eligibleCountries || []).join(", ") || "—")}
                />
                <CompareRow
                  label="Org eligibility"
                  values={compareGrants.map(
                    (g) => (g.organisationEligibility || []).join(", ") || "—",
                  )}
                />
                <CompareRow
                  label="Programme"
                  values={compareGrants.map((g) => g.programme || "—")}
                />
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <GrantDetailsSheet
        grant={selectedGrant}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onAsk={onAsk}
        onStart={onStart}
      />
    </div>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-b border-border/60 align-top">
      <td className="py-2 pr-3 font-medium text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="max-w-[160px] break-words py-2 pr-3 text-foreground">
          {v}
        </td>
      ))}
    </tr>
  );
}

function GrantCard({
  grant,
  onAsk,
  onStart,
  onViewDetails,
  saved,
  onToggleSaved,
  compareChecked,
  onToggleCompare,
  compareDisabled,
  startDisabled,
}: {
  grant: Grant;
  onAsk: (g: Grant) => void;
  onStart: (g: Grant) => void;
  onViewDetails: (g: Grant) => void;
  saved: boolean;
  onToggleSaved: () => void;
  compareChecked: boolean;
  onToggleCompare: () => void;
  compareDisabled: boolean;
  startDisabled?: boolean;
}) {
  const matchTier = matchTierFor(grant.matchPercentage ?? 0);
  const compareId = `compare-${grant.id}`;

  return (
    <article className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0 p-0">
        <div className="min-w-0 flex-1">
          <div className="break-words text-[11px] font-medium uppercase tracking-wider text-brand [overflow-wrap:anywhere]">
            {grant.programme}
          </div>
          <button
            type="button"
            onClick={() => onViewDetails(grant)}
            title={grant.title}
            className="group mt-1.5 flex w-full items-start gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <h4 className="line-clamp-2 min-w-0 flex-1 break-words text-lg font-bold leading-snug text-foreground group-hover:underline [overflow-wrap:anywhere]">
              {grant.title}
            </h4>
            <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground/60 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <MatchRing percentage={grant.matchPercentage ?? 0} tier={matchTier} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleSaved}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${grant.title} from saved grants` : `Save ${grant.title}`}
            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted"
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 text-brand" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <dl className="mt-5 grid grid-cols-2 divide-x divide-y divide-border rounded-lg border border-border sm:grid-cols-4 sm:divide-y-0">
          <MetaCell label="Funding" value={grant.fundingAmount || "—"} />
          <MetaCell
            label="Deadline"
            value={grant.deadline ? formatDeadline(grant.deadline) : "—"}
            badge={grant.deadline ? <DeadlineBadge deadline={grant.deadline} compact /> : undefined}
          />
          <MetaCell label="Type" value={grant.fundingType || "—"} />
          <MetaCell
            label="Eligibility"
            value={(grant.organisationEligibility || []).join(", ") || "—"}
          />
        </dl>

        <div className="mt-4 rounded-r-lg border-l-2 border-brand bg-brand/5 py-3 pl-3 pr-3">
          {/* The one piece of a grant card that reads like written analysis
              rather than a catalogue field, so it carries its own marker. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            Why it matches
          </div>
          <p className="mt-1 line-clamp-3 break-words text-xs text-foreground/80 [overflow-wrap:anywhere]">
            {grant.whyItMatches}
          </p>
        </div>
      </CardContent>

      <CardFooter className="mt-5 flex flex-wrap items-center gap-2 p-0">
        {/* Every card repeats these labels, so each accessible name carries
            the grant title — otherwise a screen reader's button list reads
            "Open source", "Open source", "Open source"… Each name still
            contains its visible text, per WCAG 2.5.3 (Label in Name). */}
        <Button asChild variant="outline" size="sm" className="rounded-lg hover:bg-muted">
          <a
            href={grant.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open source page for ${grant.title} (opens in a new tab)`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open source
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAsk(grant)}
          aria-label={`Ask about this grant: ${grant.title}`}
          className="rounded-lg hover:bg-muted"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Ask about this grant
        </Button>

        <label
          htmlFor={compareId}
          className={cn(
            "ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground",
            compareDisabled && !compareChecked && "cursor-not-allowed opacity-50",
          )}
        >
          <Checkbox
            id={compareId}
            checked={compareChecked}
            onCheckedChange={onToggleCompare}
            disabled={compareDisabled && !compareChecked}
            aria-label={`Compare ${grant.title}`}
          />
          Compare
        </label>

        <Button
          type="button"
          size="sm"
          onClick={() => onStart(grant)}
          // Closes the double-click window at source: a second start during
          // the await would append a second success + document block to the
          // chat, even though the pipeline upsert dedupes the row.
          disabled={startDisabled}
          aria-label={`Start application for ${grant.title}`}
          className="rounded-lg bg-brand text-brand-foreground shadow-sm hover:bg-brand/90"
        >
          {startDisabled ? "Starting…" : "Start application"}
        </Button>
      </CardFooter>
    </article>
  );
}

/** Also reused by SavedGrants.tsx, so a saved grant's card reads as the same
 * visual language as one in the results list. */
export function MetaCell({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: ReactNode;
}) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <span
          className="line-clamp-1 break-words text-xs font-medium text-foreground [overflow-wrap:anywhere]"
          title={value}
        >
          {value}
        </span>
        {badge}
      </dd>
    </div>
  );
}

/**
 * The editorial match ring: a thin circular meter (SVG stroke-dasharray, no
 * new dependency) replacing the old number+bar meter. Colour is tier-driven
 * via MATCH_TIER_CLASSES — the warm `--highlight` ochre for any real match,
 * a neutral grey for a partial one — so the ring itself never needs a
 * fourth colour to stay legible.
 */
function MatchRing({ percentage, tier }: { percentage: number; tier: MatchTier }) {
  const cls = MATCH_TIER_CLASSES[tier];
  const clamped = Math.min(100, Math.max(0, percentage));
  const size = 52;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(
              "motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700",
              cls.stroke,
            )}
          />
        </svg>
        <span
          role="img"
          aria-label={`${percentage}% match`}
          className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-foreground"
        >
          {percentage}%
        </span>
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        match
      </span>
    </div>
  );
}

function CandidateItem({
  grant,
  onAsk,
  onViewDetails,
}: {
  grant: Grant;
  onAsk: (grant: Grant) => void;
  onViewDetails: (grant: Grant) => void;
}) {
  const isWeb = getGrantSourceType(grant) === "web_discovery";
  const sourceLabel = isWeb
    ? grant.programme || "Web Discovery"
    : grant.programme || "Horizon Europe";
  const identifier =
    grant.id.startsWith("web-") || grant.id.startsWith("cand-") ? undefined : grant.id;

  return (
    <div
      onClick={() => onViewDetails(grant)}
      className="group cursor-pointer rounded-xl border border-border/80 bg-background/80 hover:border-brand/40 hover:bg-muted/40 p-3.5 transition-all space-y-2.5 shadow-2xs"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold",
              isWeb
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
            )}
          >
            {isWeb ? <Globe2 className="h-3 w-3" /> : <span>🇪🇺</span>}
            {sourceLabel}
          </span>
          {identifier && (
            <span className="text-[10px] text-muted-foreground/90 font-mono font-medium">
              {identifier}
            </span>
          )}
        </div>
        {grant.deadline && <DeadlineBadge deadline={grant.deadline} compact />}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-foreground group-hover:text-brand transition-colors line-clamp-2 leading-snug">
          {grant.title}
        </h4>
        {grant.description && (
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {grant.description}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/40">
        <div className="flex items-center gap-2">
          {grant.sourceUrl && (
            <a
              href={grant.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline bg-brand/5 hover:bg-brand/10 border border-brand/20 rounded-md px-2 py-1 transition-colors"
            >
              <span>{isWeb ? "Visit Web Source" : "Official EU Portal Call"}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(grant);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5"
          >
            <span>More info</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAsk(grant);
          }}
          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground hover:bg-background"
        >
          <MessageSquare className="h-3 w-3" />
          <span>Ask AI</span>
        </Button>
      </div>
    </div>
  );
}
