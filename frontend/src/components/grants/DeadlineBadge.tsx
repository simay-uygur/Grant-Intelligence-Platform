import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type DeadlineTier, deadlineStatus } from "@/utils/deadline";

interface Props {
  deadline: string;
  /** Tighter padding/type for squeezed contexts like the grant card's facts grid. */
  compact?: boolean;
}

/**
 * Token-based tints, so both themes follow: --destructive and --warning both
 * have .dark overrides that lift them to a light hue on a dark card, and the
 * badge is outline-only, so the text sits on the card surface rather than on
 * a tinted fill that would need its own contrast check.
 *
 * `normal` and `unknown` are absent on purpose — no entry means no badge.
 */
const TIER_CLASSES: Partial<Record<DeadlineTier, string>> = {
  overdue: "border-destructive/40 text-destructive",
  urgent: "border-warning/50 text-warning",
  soon: "border-border text-muted-foreground",
};

/** Renders nothing when the deadline doesn't parse, or is more than 30 days out. */
export function DeadlineBadge({ deadline, compact }: Props) {
  const { tier, label } = deadlineStatus(deadline);
  const tierClasses = TIER_CLASSES[tier];
  if (!tierClasses) return null;

  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap", tierClasses, compact && "px-1.5 py-0 text-[10px]")}
    >
      {label}
    </Badge>
  );
}
