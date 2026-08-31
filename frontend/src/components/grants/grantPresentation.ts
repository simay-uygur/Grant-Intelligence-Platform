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

import type { Grant } from "@/types";

export function grantResultProvenance(grants: Grant[]): "live" | "mock" | "saved" {
  if (grants.some((g) => g.provenance === "live")) return "live";
  if (grants.some((g) => g.provenance === "mock")) return "mock";
  return "saved";
}

export function getGrantSourceType(grant: Grant): "web_discovery" | "eu_portal" | "other" {
  const source = (grant.source || "").toLowerCase();
  const id = (grant.id || "").toLowerCase();
  if (source.includes("web") || id.startsWith("web-")) return "web_discovery";
  if (source.includes("eu") || source.includes("horizon") || id.startsWith("horizon-"))
    return "eu_portal";
  return "other";
}

export function getGrantSourceLabel(grant: Grant): string {
  const type = getGrantSourceType(grant);
  if (type === "web_discovery") return "Web Discovery";
  if (type === "eu_portal") return "EU Horizon API";
  if (grant.source) return grant.source;
  return "Official Portal";
}

export function getEffectiveMatchPercentage(grant: Grant): number | undefined {
  if (typeof grant.matchPercentage === "number" && grant.matchPercentage > 0) {
    return grant.matchPercentage;
  }
  return undefined;
}
