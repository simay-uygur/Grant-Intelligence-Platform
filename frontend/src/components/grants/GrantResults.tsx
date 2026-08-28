import { useMemo, useState, type ReactNode } from "react";
import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ChevronRight,
  ExternalLink,
  Globe2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  SearchX,
  Sparkles,
  Users,
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
import {
  getGrantSourceLabel,
  getGrantSourceType,
  grantResultProvenance,
  MATCH_TIER_CLASSES,
  type MatchTier,
  matchTierFor,
} from "./grantPresentation";

import { formatDeadline } from "@/utils/deadline";
import { useShortlist } from "@/hooks/useShortlist";

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
  startingGrantId,
  existingGrantIds,
}: Props) {
  const { isSaved, toggleSave } = useShortlist();
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Expandable all candidates view state
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState<"all" | "eu_portal" | "web_discovery">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggleSaved = (grant: Grant) => {
    const nextSaved = !isSaved(grant.id);
    toggleSave(grant);
    setSavedToast(
      nextSaved
        ? `Saved "${grant.title}" to your shortlisted grants.`
        : `Removed "${grant.title}" from saved grants.`,
    );
    setTimeout(() => setSavedToast(null), 3000);
  };

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
  const provenance = grantResultProvenance(grants);

  // Discover pool candidates (ensure allCandidates or fall back to grants)
  const candidatePool = useMemo(() => {
    if (allCandidates && allCandidates.length > 0) return allCandidates;
    return grants;
  }, [allCandidates, grants]);

  const euCount = useMemo(
    () => candidatePool.filter((g) => getGrantSourceType(g) === "eu_portal").length,
    [candidatePool],
  );
  const webCount = useMemo(
    () => candidatePool.filter((g) => getGrantSourceType(g) === "web_discovery").length,
    [candidatePool],
  );

  const filteredCandidates = useMemo(() => {
    return candidatePool.filter((g) => {
      if (candidateFilter !== "all" && getGrantSourceType(g) !== candidateFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = (g.title || "").toLowerCase();
        const desc = (g.description || "").toLowerCase();
        const prog = (g.programme || "").toLowerCase();
        return title.includes(q) || desc.includes(q) || prog.includes(q);
      }
      return true;
    });
  }, [candidatePool, candidateFilter, searchQuery]);

  // Zero matches is a real outcome for a real grant-seeker, not an edge case:
  // it needs to say what to change next, not just report the absence. Reachable
  // via ?mock=search-empty (see services/mockScenario.ts).
  if (grants.length === 0) {
    return (
      <EmptyState
        headingLevel="h3"
        icon={SearchX}
        title="No grants matched this profile"
        description="Nothing in the demo dataset fits every criterion you gave. Widening the funding range, allowing a longer project, or relaxing the country and sector usually opens things up — tell me what to change in the chat below, or search again as-is."
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {provenance === "mock" ? "Top " : ""}
            {grants.length} grant{grants.length === 1 ? "" : "s"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {sourceSummary ??
              (provenance === "mock"
                ? "Demo results ranked by fit with your organisation profile."
                : "Saved grant search results.")}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium flex items-center gap-1.5",
            provenance === "live"
              ? "border-brand/40 bg-brand/10 text-brand"
              : provenance === "mock"
                ? "border-amber-300/50 bg-amber-100/60 text-amber-800"
                : "border-border bg-muted text-muted-foreground",
          )}
        >
          {provenance === "live" ? (
            <>
              <span className="flex h-1.5 w-1.5 rounded-full bg-success" />
              Parallel Search: EU Portal + Web
            </>
          ) : provenance === "mock" ? (
            "Demo data"
          ) : (
            "Saved results"
          )}
        </span>
      </div>

      {savedToast && (
        <div className="rounded-lg border border-brand/20 bg-brand/5 px-3.5 py-2 text-xs font-medium text-brand animate-in fade-in slide-in-from-top-1">
          {savedToast}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {grants.map((g) => (
          <GrantCard
            key={g.id}
            grant={g}
            onAsk={onAsk}
            onStart={onStart}
            onViewDetails={openDetails}
            saved={isSaved(g.id)}
            onToggleSaved={() => handleToggleSaved(g)}
            compareChecked={compareIds.has(g.id)}
            onToggleCompare={() => toggleCompare(g.id)}
            compareDisabled={!compareIds.has(g.id) && compareIds.size >= MAX_COMPARE}
            startDisabled={startDisabled}
            isStarting={startingGrantId === g.id}
            hasDraft={existingGrantIds?.has(g.id)}
          />
        ))}
      </div>

      {/* Expandable all discovered grants & web search sources */}
      {candidatePool.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setShowAllCandidates(!showAllCandidates)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
                <Globe2 className="h-3.5 w-3.5" />
              </span>
              <div>
                <span className="font-semibold text-foreground">
                  All Discovered Opportunities & Web Sources
                </span>
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                  {candidatePool.length} found
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
              <span>{showAllCandidates ? "Hide list" : "Show all"}</span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  showAllCandidates && "rotate-90",
                )}
              />
            </div>
          </button>

          {showAllCandidates && (
            <div className="border-t border-border px-4 py-3.5 space-y-3 bg-muted/10 animate-in fade-in duration-200">
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
                    All ({candidatePool.length})
                  </Button>
                  <Button
                    type="button"
                    variant={candidateFilter === "eu_portal" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCandidateFilter("eu_portal")}
                    className="h-7 text-xs rounded-full px-2.5 gap-1"
                  >
                    <span>🇪🇺</span> EU Portal ({euCount})
                  </Button>
                  <Button
                    type="button"
                    variant={candidateFilter === "web_discovery" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCandidateFilter("web_discovery")}
                    className="h-7 text-xs rounded-full px-2.5 gap-1"
                  >
                    <span>🌐</span> Web Discovery ({webCount})
                  </Button>
                </div>

                {/* Filter / Search input */}
                {candidatePool.length > 5 && (
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

      {compareIds.size >= 1 && (
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
                  values={compareGrants.map((g) =>
                    g.matchPercentage === undefined ? undefined : `${g.matchPercentage}%`,
                  )}
                />
                <CompareRow label="Funding" values={compareGrants.map((g) => g.fundingAmount)} />
                <CompareRow
                  label="Deadline"
                  values={compareGrants.map((g) =>
                    g.deadline ? formatDeadline(g.deadline) : undefined,
                  )}
                />
                <CompareRow
                  label="Eligible countries"
                  values={compareGrants.map((g) => g.eligibleCountries?.join(", "))}
                />
                <CompareRow
                  label="Org eligibility"
                  values={compareGrants.map((g) => g.organisationEligibility?.join(", "))}
                />
                <CompareRow
                  label="Programme / source"
                  values={compareGrants.map((g) => g.programme || g.source)}
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
        hasDraft={selectedGrant ? existingGrantIds?.has(selectedGrant.id) : false}
      />
    </div>
  );
}

function CompareRow({ label, values }: { label: string; values: Array<string | undefined> }) {
  if (values.every((value) => !value?.trim())) return null;
  return (
    <tr className="border-b border-border/60 align-top">
      <td className="py-2 pr-3 font-medium text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="max-w-[160px] break-words py-2 pr-3 text-foreground">
          {v?.trim() || "Not available"}
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
  isStarting,
  hasDraft,
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
  isStarting?: boolean;
  hasDraft?: boolean;
}) {
  const matchTier =
    grant.matchPercentage === undefined ? undefined : matchTierFor(grant.matchPercentage);
  const compareId = `compare-${grant.id}`;
  const hasFacts = Boolean(
    grant.fundingAmount ||
    grant.deadline ||
    grant.fundingType ||
    grant.eligibleCountries?.length ||
    grant.organisationEligibility?.length,
  );

  const [whyExpanded, setWhyExpanded] = useState(false);
  const isWeb = getGrantSourceType(grant) === "web_discovery";
  const sourceLabel = getGrantSourceLabel(grant);

  return (
    <article
      aria-labelledby={`grant-title-${grant.id}`}
      className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-brand/30 hover:shadow-md"
    >
      <CardHeader className="flex flex-col gap-3 p-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                isWeb
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
              )}
            >
              {isWeb ? <Globe2 className="h-3 w-3" /> : <span>🇪🇺</span>}
              {sourceLabel}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {grant.programme || (isWeb ? "Web Grant Discovery" : "Horizon Europe")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onViewDetails(grant)}
            className="group mt-0.5 flex w-full items-start gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <h4
              id={`grant-title-${grant.id}`}
              className="line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-brand [overflow-wrap:anywhere]"
            >
              {grant.title}
            </h4>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:self-start">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleSaved}
            aria-label={saved ? `Remove ${grant.title} from saved` : `Save ${grant.title}`}
            className="h-8 w-8 rounded-full hover:bg-muted"
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 text-brand" />
            ) : (
              <Bookmark className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>

          {grant.matchPercentage !== undefined && (
            <MatchMeter percentage={grant.matchPercentage} tier={matchTier!} />
          )}
        </div>
      </CardHeader>

      <CardContent className="mt-4 flex-1 p-0">
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {grant.description}
        </p>

        {hasFacts && (
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-4">
            {grant.fundingAmount ? (
              <Fact
                label="Funding"
                value={grant.fundingAmount}
                icon={<Sparkles className="h-3 w-3" />}
              />
            ) : null}
            {grant.fundingType ? <Fact label="Funding type" value={grant.fundingType} /> : null}
            {grant.deadline ? (
              <Fact
                label="Deadline"
                value={formatDeadline(grant.deadline)}
                icon={<CalendarClock className="h-3 w-3" />}
                badge={<DeadlineBadge deadline={grant.deadline} compact />}
              />
            ) : null}
            {grant.eligibleCountries?.length ? (
              <Fact
                label="Eligible countries"
                value={grant.eligibleCountries.join(", ")}
                icon={<Globe2 className="h-3 w-3" />}
              />
            ) : null}
            {grant.organisationEligibility?.length ? (
              <Fact
                label="Organisation eligibility"
                value={grant.organisationEligibility.join(", ")}
                icon={<Users className="h-3 w-3" />}
                className="col-span-2 sm:col-span-1"
              />
            ) : null}
          </dl>
        )}

        {grant.whyItMatches && (
          <div className="mt-4 rounded-xl bg-brand/5 p-3 transition-all duration-200 border border-brand/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                <Sparkles className="h-3.5 w-3.5" />
                Why it was returned
              </div>
              {grant.whyItMatches.length > 130 && (
                <button
                  type="button"
                  onClick={() => setWhyExpanded(!whyExpanded)}
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand hover:underline cursor-pointer"
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
            <div className="mt-1.5">
              <p
                className={cn(
                  "whitespace-pre-wrap break-words text-xs text-foreground/85 leading-relaxed [overflow-wrap:anywhere]",
                  !whyExpanded && grant.whyItMatches.length > 130 && "line-clamp-2",
                )}
              >
                {grant.whyItMatches}
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-5 flex flex-wrap items-center gap-2 p-0">
        {grant.sourceUrl && (
          <Button asChild variant="outline" size="sm" className="rounded-lg hover:bg-muted">
            <a href={grant.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open source
            </a>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAsk(grant)}
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
          />
          Compare
        </label>

        <Button
          type="button"
          size="sm"
          onClick={() => onStart(grant)}
          disabled={startDisabled || isStarting}
          className="rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90"
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Starting...
            </>
          ) : hasDraft ? (
            "Open application"
          ) : (
            "Start application"
          )}
        </Button>
      </CardFooter>
    </article>
  );
}

function Fact({
  label,
  value,
  icon,
  badge,
  className,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
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

function MatchMeter({ percentage, tier }: { percentage: number; tier: MatchTier }) {
  const cls = MATCH_TIER_CLASSES[tier];
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div className="flex w-16 shrink-0 flex-col items-end gap-1.5">
      <div className="text-right leading-none">
        <span className={cn("text-lg font-medium tabular-nums", cls.text)}>{percentage}%</span>
        <div className="mt-0.5 text-[10px] text-muted-foreground">match</div>
      </div>
      <div
        role="img"
        aria-label={`${percentage}% match`}
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", cls.bar)} style={{ width: `${clamped}%` }} />
      </div>
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
