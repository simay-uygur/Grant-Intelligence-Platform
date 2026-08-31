export type MatchTier = "excellent" | "strong" | "good" | "partial";

export function matchTierFor(percentage: number): MatchTier {
  if (percentage >= 85) return "excellent";
  if (percentage >= 70) return "strong";
  if (percentage >= 50) return "good";
  return "partial";
}

export const MATCH_TIER_LABEL: Record<MatchTier, string> = {
  excellent: "Excellent match",
  strong: "Strong match",
  good: "Good match",
  partial: "Partial match",
};

/**
 * The match ring's stroke colour, by tier — editorial and deliberately
 * restrained: any real match (good and above) reads in the same warm
 * `--highlight` ochre, so the ring reads as one calm visual language rather
 * than a four-colour traffic light. Only `partial` breaks from it, in a
 * neutral grey, so a weak match doesn't borrow the same celebratory accent
 * as a strong one.
 */
export const MATCH_TIER_CLASSES: Record<MatchTier, { stroke: string }> = {
  excellent: { stroke: "stroke-highlight" },
  strong: { stroke: "stroke-highlight" },
  good: { stroke: "stroke-highlight" },
  partial: { stroke: "stroke-muted-foreground/50" },
};
