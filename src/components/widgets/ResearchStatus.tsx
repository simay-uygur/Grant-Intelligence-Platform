import { AlertCircle, Check, Search } from "lucide-react";
import type { ResearchState, ResearchStep } from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DemoBadge } from "@/components/common/DemoBadge";

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
            <DemoBadge marker="demo-data" compact />
          </h3>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {hasError
              ? "The simulated search hit a problem — you can retry below."
              : preparingResults
                ? "Preparing your recommendations…"
                : (activeStep?.label ?? "Matching your profile against the local demo dataset.")}
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
        {/* Explicit role: list-style:none from preflight otherwise strips the
            list semantics, so the step count isn't announced. */}
        <ol role="list" className="mt-3 space-y-2 sm:mt-4">
          {state.steps.map((step, i) => (
            <li
              key={i}
              aria-current={step.status === "active" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors sm:gap-3 sm:px-3.5 sm:py-2.5",
                ROW_STATE_CLASSES[step.status],
              )}
            >
              <StepMarker status={step.status} index={i} />
              <span
                className={cn(
                  "min-w-0 flex-1 break-words",
                  step.status === "pending" ? "text-muted-foreground" : "text-foreground",
                  step.status === "active" && "font-medium",
                )}
              >
                {step.label}
              </span>
              <StepStatusIndicator status={step.status} />
            </li>
          ))}
        </ol>

        {preparingResults && <RecommendationSkeletons />}

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

function RecommendationSkeletons() {
  return (
    <div className="mt-4 space-y-2.5 sm:mt-5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="h-3 w-2/5 rounded-full bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-14 shrink-0 rounded-full bg-muted motion-safe:animate-pulse" />
          </div>
          <div className="h-3.5 w-3/4 rounded-full bg-muted motion-safe:animate-pulse" />
          <div className="h-3 w-full rounded-full bg-muted motion-safe:animate-pulse" />
          <div className="h-3 w-5/6 rounded-full bg-muted motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
