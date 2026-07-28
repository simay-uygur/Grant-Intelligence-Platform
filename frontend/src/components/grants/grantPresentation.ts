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

export const MATCH_TIER_CLASSES: Record<MatchTier, { text: string; bar: string; ring: string }> = {
  excellent: { text: "text-success", bar: "bg-success", ring: "ring-success/25" },
  strong: { text: "text-brand", bar: "bg-brand", ring: "ring-brand/25" },
  good: { text: "text-warning", bar: "bg-warning", ring: "ring-warning/25" },
  partial: { text: "text-muted-foreground", bar: "bg-muted-foreground", ring: "ring-border" },
};
