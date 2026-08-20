import { useMemo, useState, type ReactNode } from "react";
import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ChevronRight,
  ExternalLink,
  Globe2,
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
import { InlineNotice } from "@/components/common/InlineNotice";
import { DemoBadge } from "@/components/common/DemoBadge";
import { EmptyState } from "@/components/EmptyState";
import { useShortlist } from "@/hooks/useShortlist";
import { MATCH_TIER_CLASSES, type MatchTier, matchTierFor } from "./grantPresentation";
import { formatDeadline } from "@/utils/deadline";

interface Props {
  grants: Grant[];
  onAsk: (grant: Grant) => void;
  onStart: (grant: Grant) => void;
  /** Re-runs the search from the stored profile; absent if there's nothing to retry from. */
  onRetryResearch?: () => void;
  /** True while a start is already in flight, so it can't be fired twice. */
  startDisabled?: boolean;
}

const MAX_COMPARE = 3;

export function GrantResults({ grants, onAsk, onStart, onRetryResearch, startDisabled }: Props) {
  // Saved grants are durable (gi.shortlist.v1) and shared across every
  // GrantResults on screen; compare below stays deliberately ephemeral.
  const { isSaved, toggleSave } = useShortlist();
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  // Kept separate from `detailsOpen` so the sheet's exit animation still has
  // a grant to render while it closes, instead of unmounting mid-slide.
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
            Top {grants.length} matched grant{grants.length === 1 ? "" : "s"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Ranked by fit with your organisation profile.
          </p>
        </div>
        <DemoBadge marker="demo-data" />
      </div>

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

      {/* Appears as soon as one grant is checked, not just at two — a user
          who checks a single box and sees nothing happen has no way to know
          the feature exists. Static (not sticky): it sits right after the
          grid rather than trailing behind scroll position in a block that's
          embedded partway down a long chat transcript. */}
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
                  values={compareGrants.map((g) => `${g.matchPercentage}%`)}
                />
                <CompareRow label="Funding" values={compareGrants.map((g) => g.fundingAmount)} />
                <CompareRow
                  label="Deadline"
                  values={compareGrants.map((g) => formatDeadline(g.deadline))}
                />
                <CompareRow
                  label="Eligible countries"
                  values={compareGrants.map((g) => g.eligibleCountries.join(", "))}
                />
                <CompareRow
                  label="Org eligibility"
                  values={compareGrants.map((g) => g.organisationEligibility.join(", "))}
                />
                <CompareRow label="Programme" values={compareGrants.map((g) => g.programme)} />
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
  const matchTier = matchTierFor(grant.matchPercentage);
  const compareId = `compare-${grant.id}`;

  return (
    <article className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0 p-0">
        <div className="min-w-0 flex-1">
          <div className="break-words text-[11px] font-medium text-brand [overflow-wrap:anywhere]">
            {grant.programme}
          </div>
          <button
            type="button"
            onClick={() => onViewDetails(grant)}
            title={grant.title}
            className="group mt-1 flex w-full items-start gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <h4 className="line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold text-foreground group-hover:underline [overflow-wrap:anywhere]">
              {grant.title}
            </h4>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <MatchMeter percentage={grant.matchPercentage} tier={matchTier} />
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
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs sm:grid-cols-3">
          <Fact label="Funding" value={grant.fundingAmount} />
          <Fact
            label="Deadline"
            value={formatDeadline(grant.deadline)}
            icon={<CalendarClock className="h-3 w-3" />}
            badge={<DeadlineBadge deadline={grant.deadline} compact />}
          />
          <Fact label="Funding type" value={grant.fundingType} />
          <Fact
            label="Eligible countries"
            value={grant.eligibleCountries.join(", ")}
            icon={<Globe2 className="h-3 w-3" />}
          />
          <Fact
            label="Organisation eligibility"
            value={grant.organisationEligibility.join(", ")}
            icon={<Users className="h-3 w-3" />}
            className="col-span-2 sm:col-span-1"
          />
        </dl>

        <div className="mt-4 rounded-lg bg-brand/5 p-3">
          {/* The one piece of a grant card that reads like written analysis
              rather than a catalogue field, so it carries its own marker. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            Why it matches
            <DemoBadge marker="sample-result" compact className="ml-0.5" />
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
          className="rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90"
        >
          {startDisabled ? "Starting…" : "Start application"}
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
