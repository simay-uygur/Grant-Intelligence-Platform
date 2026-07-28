import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { deadlineUrgency } from "@/utils/deadline";

interface Props {
  deadline: string;
  /** Tighter padding/type for squeezed contexts like the grant card's facts grid. */
  compact?: boolean;
}

/** Renders nothing when the deadline doesn't parse, or isn't expired/imminent. */
export function DeadlineBadge({ deadline, compact }: Props) {
  const urgency = deadlineUrgency(deadline);
  if (!urgency) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        urgency === "expired"
          ? "border-destructive/40 text-destructive"
          : "border-warning/50 text-warning",
        compact && "px-1.5 py-0 text-[10px]",
      )}
    >
      {urgency === "expired" ? "Expired" : "Closing soon"}
    </Badge>
  );
}
