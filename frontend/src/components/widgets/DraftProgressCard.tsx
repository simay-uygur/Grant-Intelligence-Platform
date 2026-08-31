import { useEffect, useRef } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { DraftProgressState } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { stripLeadingNumber } from "@/utils/text";

interface Props {
  state: DraftProgressState;
}

export function DraftProgressCard({ state }: Props) {
  const percent = Math.min(100, Math.max(0, state.percent));
  const current = state.sectionIndex ?? 1;
  const total = state.totalSections ?? 12;
  const liveContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (liveContainerRef.current) {
      liveContainerRef.current.scrollTop = liveContainerRef.current.scrollHeight;
    }
  }, [state.liveTextChunk]);

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
          {percent > 0 ? (
            <>
              <span className="text-base font-bold text-brand">{percent}%</span>
              <span className="block text-[10px] text-muted-foreground">complete</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
              Document is being written...
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3.5 p-0 pt-1">
        {percent > 0 ? (
          <Progress value={percent} className="h-2 rounded-full" />
        ) : (
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 w-1/3 animate-pulse rounded-full bg-brand/60" />
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs sm:px-3.5 sm:py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {percent > 0 && current > 0 ? (
                <span className="shrink-0 rounded-md bg-brand/10 px-2 py-0.5 font-medium text-brand">
                  Section {current} of {total}
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-brand/10 px-2 py-0.5 font-medium text-brand">
                  Drafting
                </span>
              )}
              <span className="truncate font-semibold text-foreground">
                {state.currentSectionTitle
                  ? stripLeadingNumber(state.currentSectionTitle)
                  : "Document is being written..."}
              </span>
            </div>
            {percent === 100 && (
              <span className="flex shrink-0 items-center gap-1 font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Done
              </span>
            )}
          </div>
          {Boolean(state.thought) && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 italic">{state.thought}</p>
          )}
        </div>

        {/* Live Streaming Text Preview Container */}
        {percent < 100 && Boolean(state.liveTextChunk) && (
          <div
            ref={liveContainerRef}
            className="max-h-36 overflow-y-auto rounded-xl border border-brand/20 bg-card p-3 font-sans text-xs leading-relaxed text-foreground shadow-sm"
          >
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-brand">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
                Streaming Live &bull;{" "}
                {state.currentSectionTitle
                  ? stripLeadingNumber(state.currentSectionTitle)
                  : "Drafting"}
              </span>
              {Boolean(state.wordCount) && (
                <span className="font-mono text-muted-foreground">{state.wordCount} words</span>
              )}
            </div>
            <div className="whitespace-pre-wrap font-normal text-muted-foreground [overflow-wrap:anywhere]">
              {state.liveTextChunk}
              <span className="ml-1 inline-block h-3.5 w-1.5 bg-brand animate-pulse align-middle" />
            </div>
          </div>
        )}

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
