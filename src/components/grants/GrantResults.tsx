import { useMemo, useState, type ReactNode } from "react";
import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ExternalLink,
  Globe2,
  MessageSquare,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { Grant } from "@/types";
import { cn } from "@/lib/utils";
import { CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  grants: Grant[];
  onAsk: (grant: Grant) => void;
  onStart: (grant: Grant) => void;
}

const MAX_COMPARE = 3;

export function GrantResults({ grants, onAsk, onStart }: Props) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const toggleSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  // Defensive empty state — grants is always populated by the mock service
  // today, but an empty array is a perfectly valid value of the existing
  // Grant[] contract, so it deserves a clear message rather than a blank grid.
  if (grants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        No matching grants were found for this profile.
      </div>
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
        <span className="shrink-0 rounded-full border border-amber-300/50 bg-amber-100/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">
          Demo data
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {grants.map((g) => (
          <GrantCard
            key={g.id}
            grant={g}
            onAsk={onAsk}
            onStart={onStart}
            saved={savedIds.has(g.id)}
            onToggleSaved={() => toggleSaved(g.id)}
            compareChecked={compareIds.has(g.id)}
            onToggleCompare={() => toggleCompare(g.id)}
            compareDisabled={!compareIds.has(g.id) && compareIds.size >= MAX_COMPARE}
          />
        ))}
      </div>

      {compareIds.size >= 2 && (
        <div className="sticky bottom-2 flex justify-center">
          <Button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="rounded-full bg-foreground text-background shadow-lg hover:bg-foreground/90"
          >
            <Scale className="h-3.5 w-3.5" />
            Compare {compareIds.size} grants
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
  saved,
  onToggleSaved,
  compareChecked,
  onToggleCompare,
  compareDisabled,
}: {
  grant: Grant;
  onAsk: (g: Grant) => void;
  onStart: (g: Grant) => void;
  saved: boolean;
  onToggleSaved: () => void;
  compareChecked: boolean;
  onToggleCompare: () => void;
  compareDisabled: boolean;
}) {
  const urgency = deadlineUrgency(grant.deadline);
  const matchTier = matchTierFor(grant.matchPercentage);
  const compareId = `compare-${grant.id}`;

  return (
    <article className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0 p-0">
        <div className="min-w-0 flex-1">
          <div className="break-words text-[11px] font-medium uppercase tracking-wider text-brand [overflow-wrap:anywhere]">
            {grant.programme}
          </div>
          <h4
            className="mt-1 line-clamp-2 break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]"
            title={grant.title}
          >
            {grant.title}
          </h4>
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
            badge={
              urgency === "expired" ? (
                <Badge
                  variant="outline"
                  className="border-destructive/40 px-1.5 py-0 text-[10px] text-destructive"
                >
                  Expired
                </Badge>
              ) : urgency === "urgent" ? (
                <Badge
                  variant="outline"
                  className="border-warning/50 px-1.5 py-0 text-[10px] text-warning"
                >
                  Closing soon
                </Badge>
              ) : null
            }
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
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            Why it matches
          </div>
          <p className="mt-1 line-clamp-3 break-words text-xs text-foreground/80 [overflow-wrap:anywhere]">
            {grant.whyItMatches}
          </p>
        </div>
      </CardContent>

      <CardFooter className="mt-5 flex flex-wrap items-center gap-2 p-0">
        <Button asChild variant="outline" size="sm" className="rounded-lg hover:bg-muted">
          <a href={grant.sourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Open source
          </a>
        </Button>
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
          className="rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90"
        >
          Start application
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

type MatchTier = "excellent" | "strong" | "good" | "partial";

function matchTierFor(percentage: number): MatchTier {
  if (percentage >= 85) return "excellent";
  if (percentage >= 70) return "strong";
  if (percentage >= 50) return "good";
  return "partial";
}

const MATCH_TIER_LABEL: Record<MatchTier, string> = {
  excellent: "Excellent match",
  strong: "Strong match",
  good: "Good match",
  partial: "Partial match",
};

const MATCH_TIER_CLASSES: Record<MatchTier, { text: string; bar: string; ring: string }> = {
  excellent: { text: "text-success", bar: "bg-success", ring: "ring-success/25" },
  strong: { text: "text-brand", bar: "bg-brand", ring: "ring-brand/25" },
  good: { text: "text-warning", bar: "bg-warning", ring: "ring-warning/25" },
  partial: { text: "text-muted-foreground", bar: "bg-muted-foreground", ring: "ring-border" },
};

function MatchMeter({ percentage, tier }: { percentage: number; tier: MatchTier }) {
  const cls = MATCH_TIER_CLASSES[tier];
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div className={cn("flex shrink-0 flex-col items-end gap-1 rounded-xl p-2 ring-1", cls.ring)}>
      <div className="flex items-baseline gap-0.5">
        <span className={cn("text-xl font-bold leading-none tabular-nums", cls.text)}>
          {percentage}
        </span>
        <span className={cn("text-xs font-medium", cls.text)}>%</span>
      </div>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", cls.bar)} style={{ width: `${clamped}%` }} />
      </div>
      <span className={cn("text-[10px] font-medium leading-tight", cls.text)}>
        {MATCH_TIER_LABEL[tier]}
      </span>
    </div>
  );
}

function parseDeadline(value: string): Date | null {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function formatDeadline(value: string): string {
  const date = parseDeadline(value);
  return date ? format(date, "d MMM yyyy") : value;
}

const URGENT_WITHIN_DAYS = 21;

function deadlineUrgency(value: string): "expired" | "urgent" | null {
  const date = parseDeadline(value);
  if (!date) return null;
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0) return "expired";
  if (days <= URGENT_WITHIN_DAYS) return "urgent";
  return null;
}
