import type { Grant } from "@/types";

export type MatchTier = "excellent" | "strong" | "good" | "partial";
export type GrantResultProvenance = "live" | "mock" | "saved";
export type GrantSourceType = "eu_portal" | "web_discovery" | "unknown";

export function grantResultProvenance(grants: Grant[]): GrantResultProvenance {
  if (grants.some((grant) => grant.provenance === "live")) return "live";
  if (grants.length > 0 && grants.every((grant) => grant.provenance === "mock")) return "mock";
  return "saved";
}

export function getGrantSourceType(grant: Grant): GrantSourceType {
  const source = (grant.source || "").toLowerCase();
  const prog = (grant.programme || "").toLowerCase();
  const id = (grant.id || "").toLowerCase();

  if (source.includes("web") || prog.includes("web") || id.startsWith("web-")) {
    return "web_discovery";
  }
  if (
    source.includes("eu") ||
    source.includes("horizon") ||
    prog.includes("horizon") ||
    prog.includes("digital europe") ||
    prog.includes("life") ||
    prog.includes("erasmus") ||
    prog.includes("cef") ||
    prog.includes("edf")
  ) {
    return "eu_portal";
  }
  return "eu_portal";
}

export function getGrantSourceLabel(grant: Grant): string {
  const type = getGrantSourceType(grant);
  if (type === "web_discovery") {
    return "Web Discovery";
  }
  return "EU Horizon API";
}

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
