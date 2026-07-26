import type { ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "error" | "warning" | "empty";

const TONE_CLASSES: Record<NoticeTone, string> = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/10 text-warning",
  empty: "border-dashed border-border bg-muted/30 text-muted-foreground",
};

/**
 * Compact, single-line-friendly notice used for empty/unavailable/error
 * states across the app — deliberately not a large card, so it stays
 * proportionate wherever it's dropped in (a chat block, a sheet, a form).
 */
export function InlineNotice({
  tone,
  children,
  className,
}: {
  tone: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === "empty" ? Info : AlertCircle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
