import { AlertCircle, Check, Database, Globe2, Search } from "lucide-react";
import type {
  ResearchSourceProgress,
  ResearchSourceStatus,
  ResearchState,
  ResearchStep,
} from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Props {
  state: ResearchState;
  onRetry?: () => void;
  hasResults?: boolean;
}

// Faint border/background per row-card, distinct per step state — the active
// row gets a subtle brand tint, pending stays close to transparent, done
// settles into a plain card surface.
const ROW_STATE_CLASSES: Record<ResearchStep["status"], string> = {
  done: "border-border/60 bg-card",
  active: "border-brand/30 bg-brand/5",
  pending: "border-border/40 bg-transparent",
};

const SOURCE_STATE_CLASSES: Record<ResearchSourceStatus, string> = {
  done: "border-border/60 bg-card",
  active: "border-brand/30 bg-brand/5",
  pending: "border-border/50 bg-muted/20",
  error: "border-warning/40 bg-warning/10",
};

const defaultSources: ResearchSourceProgress[] = [
  {
    id: "eu_portal",
    label: "EU Portal",
    detail: "Horizon Europe / SEDIA",
    status: "pending",
  },
  {
    id: "web_discovery",
    label: "Web Discovery",
    detail: "National & regional funding sources",
    status: "pending",
  },
];

export function ResearchStatus({ state, onRetry, hasResults }: Props) {
  const total = state.steps.length;
  const doneCount = state.steps.filter((s) => s.status === "done").length;
  const activeIndex = state.steps.findIndex((s) => s.status === "active");
  const activeStep = activeIndex >= 0 ? state.steps[activeIndex] : undefined;
  const allDone = total > 0 && doneCount === total;
  const hasError = Boolean(state.error);
  // Once every step is done, the parent is still fetching the matched
  // grants — this brief window is where we show recommendation skeletons.
  const preparingResults = allDone && !hasError && !hasResults;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const progressAnnouncement = hasError
    ? `Research failed: ${state.error}`
    : preparingResults
      ? "Preparing your recommendations."
      : activeStep
        ? `Step ${activeIndex + 1} of ${total}: ${activeStep.label}. ${percent}% complete.`
        : allDone
          ? "Research complete."
          : "";

  return (
    <Card className="rounded-2xl p-4 shadow-sm sm:p-5">
      <div aria-live="polite" role="status" className="sr-only">
        {progressAnnouncement}
      </div>

      <CardHeader className="flex-row flex-wrap items-center gap-3 space-y-0 p-0">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            hasError
              ? "bg-destructive/10 text-destructive"
              : allDone
                ? "bg-success/10 text-success"
                : "bg-brand/10 text-brand",
          )}
        >
          {hasError ? (
            <AlertCircle className="h-4 w-4" />
          ) : allDone ? (
            <Check className="h-4 w-4" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {/* On the heading rather than the subtitle: the subtitle changes as
              steps advance and disappears once the run finishes, but the
              marker has to stay true of the finished result too. */}
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
            {hasError ? "Research failed" : allDone ? "Research complete" : "Researching grants…"}
          </h3>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {hasError
              ? "The grant search hit a problem — you can retry below."
              : preparingResults
                ? "Preparing your recommendations…"
                : (activeStep?.detail ??
                  activeStep?.label ??
                  "Matching your profile against live grant opportunities.")}
          </div>
        </div>
        {!hasError && (
          <div className="shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
            {doneCount}/{total}
            <span className="block text-[10px] font-normal text-muted-foreground/80">
              {percent}%
            </span>
          </div>
        )}
      </CardHeader>

      {!hasError && (
        <Progress value={percent} aria-label="Overall research progress" className="mt-3 h-1.5" />
      )}

      <CardContent className="p-0">
        <ol className="mt-3 space-y-2 sm:mt-4">
          {state.steps.map((step, i) => {
            const isDiscoveryStep = i === 1;
            const isRankingStep = i === 2;
            const count = isRankingStep ? step.selectedCount : undefined;
            const countLabel =
              count !== undefined && step.status !== "pending"
                ? isRankingStep
                  ? `${count} selected`
                  : `${count} candidates`
                : undefined;
            const sources = state.sources
              ? [state.sources.eu_portal, state.sources.web_discovery]
              : defaultSources.map((source) => ({
                  ...source,
                  candidateCount:
                    source.id === "eu_portal"
                      ? (state.euCount ?? step.euCount)
                      : (state.webCount ?? step.webCount),
                  status:
                    isDiscoveryStep && (step.status === "active" || step.status === "done")
                      ? step.status
                      : source.status,
                }));

            return (
              <li
                key={i}
                aria-current={step.status === "active" ? "step" : undefined}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm transition-colors sm:px-3.5 sm:py-2.5",
                  ROW_STATE_CLASSES[step.status],
                )}
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <StepMarker status={step.status} index={i} />
                  <div className="min-w-0 flex-1 break-words">
                    <span
                      className={cn(
                        "block",
                        step.status === "pending" ? "text-muted-foreground" : "text-foreground",
                        step.status === "active" && "font-medium",
                      )}
                    >
                      {step.label}
                    </span>
                    {step.detail && (
                      <span className="mt-0.5 block text-xs text-muted-foreground/90 font-normal">
                        {step.detail}
                      </span>
                    )}
                  </div>
                  {countLabel && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums transition-all",
                        step.status === "active"
                          ? "bg-brand/15 text-brand animate-pulse"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {countLabel}
                    </span>
                  )}
                  <StepStatusIndicator status={step.status} />
                </div>

                {isDiscoveryStep && (step.status === "active" || step.status === "done") && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sources.map((source) => (
                      <SourceLane key={source.id} source={source} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {state.error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Research failed</div>
              <div className="mt-0.5 break-words opacity-90 [overflow-wrap:anywhere]">
                {state.error}
              </div>
            </div>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                onClick={onRetry}
                className="h-auto shrink-0 rounded-md border-destructive/40 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
              >
                Retry
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceLane({ source }: { source: ResearchSourceProgress }) {
  const Icon = source.id === "eu_portal" ? Database : Globe2;
  const statusText =
    source.status === "done"
      ? "Done"
      : source.status === "active"
        ? "Searching"
        : source.status === "error"
          ? "Issue"
          : "Waiting";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-xs transition-all",
        SOURCE_STATE_CLASSES[source.status],
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <span className="block truncate font-medium text-foreground">{source.label}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {source.error ?? source.detail}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {source.candidateCount !== undefined && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {source.candidateCount} candidates
          </span>
        )}
        <SourceStatusIndicator status={source.status} label={statusText} />
      </div>
    </div>
  );
}

function SourceStatusIndicator({ status, label }: { status: ResearchSourceStatus; label: string }) {
  if (status === "done") {
    return <Check className="h-3.5 w-3.5 text-success" aria-label={label} />;
  }
  if (status === "error") {
    return <AlertCircle className="h-3.5 w-3.5 text-warning" aria-label={label} />;
  }
  if (status === "active") {
    return (
      <span
        className="h-1.5 w-1.5 rounded-full bg-brand motion-safe:animate-pulse"
        aria-label={label}
        role="img"
      />
    );
  }
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
      aria-label={label}
      role="img"
    />
  );
}

function StepMarker({ status, index }: { status: ResearchStep["status"]; index: number }) {
  if (status === "done") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand/40 motion-safe:animate-ping" />
        <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-medium text-white">
          {index + 1}
        </span>
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
      {index + 1}
    </span>
  );
}

/** Compact right-aligned status glyph for a step row — a quick "current state at a glance" signal, distinct from the numbered/check marker on the left. */
function StepStatusIndicator({ status }: { status: ResearchStep["status"] }) {
  if (status === "done") {
    return <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />;
  }
  if (status === "active") {
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-brand motion-safe:animate-pulse"
        aria-hidden="true"
      />
    );
  }
  return (
    <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden="true" />
  );
}
