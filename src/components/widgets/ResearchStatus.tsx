import { Check, Loader2, AlertCircle } from "lucide-react";
import type { ResearchState } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  state: ResearchState;
  onRetry?: () => void;
}

export function ResearchStatus({ state, onRetry }: Props) {
  const activeIndex = state.steps.findIndex((s) => s.status === "active");
  const allDone = state.steps.every((s) => s.status === "done");
  const progressAnnouncement = state.error
    ? `Research failed: ${state.error}`
    : activeIndex >= 0
      ? `Step ${activeIndex + 1} of ${state.steps.length}: ${state.steps[activeIndex].label}`
      : allDone
        ? "Research complete."
        : "";

  return (
    <Card className="rounded-2xl p-5 shadow-sm">
      <div aria-live="polite" role="status" className="sr-only">
        {progressAnnouncement}
      </div>
      <CardHeader className="mb-3 flex-row items-center gap-2 space-y-0 p-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">Researching grants…</div>
          <div className="text-xs text-muted-foreground">
            Scanning European funding programmes for the best matches.
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ol className="mt-2 space-y-2">
          {state.steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  step.status === "done"
                    ? "bg-emerald-500 text-white"
                    : step.status === "active"
                      ? "bg-brand text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step.status === "done" ? (
                  <Check className="h-3 w-3" />
                ) : step.status === "active" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={step.status === "pending" ? "text-muted-foreground" : "text-foreground"}
              >
                {step.label}
              </span>
            </li>
          ))}
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
