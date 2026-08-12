/**
 * Opt-in failure/empty scenarios for local mock services.
 *
 * Trigger with a comma-separated `mock` query parameter, for example:
 *
 *   ?mock=search-empty
 *   ?mock=search-error
 *   ?mock=generate-error
 *   ?mock=rewrite-error
 */
export type MockScenario = "search-empty" | "search-error" | "generate-error" | "rewrite-error";

const SCENARIOS: readonly MockScenario[] = [
  "search-empty",
  "search-error",
  "generate-error",
  "rewrite-error",
];

export function isMockScenario(scenario: MockScenario): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = new URLSearchParams(window.location.search).get("mock");
    if (!raw) return false;
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is MockScenario => (SCENARIOS as readonly string[]).includes(value))
      .includes(scenario);
  } catch {
    return false;
  }
}
