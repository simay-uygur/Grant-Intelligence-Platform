import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The app's whole vocabulary for "this isn't real", in one place.
 *
 * Every surface that needs to say so uses one of these three markers, so the
 * words are identical everywhere and can't drift into "mock" here, "sample"
 * there, "simulated" somewhere else:
 *
 *   demo-data      facts that come from the local catalogue, not a live source
 *   sample-result  analysis derived from that catalogue (a match explanation)
 *   mock-draft     prose that could be mistaken for a language model's output
 *
 * Deliberately styled as a calm neutral chip rather than a warning: the point
 * is that a user is never surprised later, not that they feel warned now. The
 * label is real text, so it survives greyscale, colour blindness and a screen
 * reader — the colour adds nothing the words don't already say.
 */
export type DemoMarker = "demo-data" | "sample-result" | "mock-draft";

const MARKER_LABELS: Record<DemoMarker, string> = {
  "demo-data": "Demo data",
  "sample-result": "Sample result",
  "mock-draft": "Mock draft — not real AI",
};

interface Props {
  marker: DemoMarker;
  /** Tighter padding/type for dense rows like a card's meta line. */
  compact?: boolean;
  className?: string;
}

export function DemoBadge({ marker, compact, className }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 whitespace-nowrap border-border bg-muted/40 font-medium text-muted-foreground",
        compact && "px-1.5 py-0 text-[10px]",
        className,
      )}
    >
      {MARKER_LABELS[marker]}
    </Badge>
  );
}
