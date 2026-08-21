import { CheckCircle2, Sparkles } from "lucide-react";
import type { DraftProgressState } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  state: DraftProgressState;
}

export function DraftProgressCard({ state }: Props) {
  const percent = Math.min(100, Math.max(0, state.percent));
  const current = state.sectionIndex ?? 1;
  const total = state.totalSections ?? 12;

  return (
    <Card className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-3">
        <div className="flex items-center gap-2.5 min-w-0 pr-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Drafting Grant Application</h3>
            <p className="line-clamp-1 text-xs text-muted-foreground" title={state.grantTitle}>
              {state.grantTitle}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right tabular-nums">
          <span className="text-base font-bold text-brand">{percent}%</span>
          <span className="block text-[10px] text-muted-foreground">complete</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3.5 p-0 pt-1">
        <Progress value={percent} className="h-2 rounded-full" />

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs sm:px-3.5 sm:py-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="shrink-0 rounded-md bg-brand/10 px-2 py-0.5 font-medium text-brand">
              Section {current} of {total}
            </span>
            <span className="truncate font-semibold text-foreground">
              {state.currentSectionTitle ?? "Preparing application sections..."}
            </span>
          </div>
          {percent === 100 && (
            <span className="flex shrink-0 items-center gap-1 font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </span>
          )}
        </div>

        {/* 12-step dots indicator */}
        <div className="flex items-center gap-1 pt-1">
          {Array.from({ length: total }, (_, i) => {
            const stepNum = i + 1;
            const isDone = stepNum < current || percent === 100;
            const isCurrent = stepNum === current && percent < 100;
            return (
              <div
                key={i}
                title={`Section ${stepNum}`}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-300",
                  isDone ? "bg-brand" : isCurrent ? "bg-brand/60 animate-pulse" : "bg-muted",
                )}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
