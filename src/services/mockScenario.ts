/**
 * Opt-in failure/empty scenarios for the mock service.
 *
 * The happy path stays the default: nothing here is active unless the page
 * URL asks for it, so normal use and the scripted demo are untouched. Scoped
 * per flow rather than one global switch, because a global "fail everything"
 * would make the later flows unreachable — a failing search means you never
 * get as far as generating an application.
 *
 * Trigger by adding a `mock` query parameter, comma-separated to combine:
 *
 *   ?mock=search-empty     grant search returns zero matches
 *   ?mock=search-error     grant search fails (research card shows retry)
 *   ?mock=generate-error   "Start application" fails
 *   ?mock=rewrite-error    "Rewrite (mock AI)" fails
 *   ?mock=search-empty,rewrite-error
 *
 * Remove the parameter (or reload without it) to get the happy path back —
 * including when retrying, which is deliberate: a retry that always succeeds
 * would be its own kind of fake.
 */
export type MockScenario = "search-empty" | "search-error" | "generate-error" | "rewrite-error";

const SCENARIOS: readonly MockScenario[] = [
  "search-empty",
  "search-error",
  "generate-error",
  "rewrite-error",
];

/**
 * Read per call rather than once at module load: the flag then follows the
 * current URL, and there's nothing to evaluate during SSR.
 */
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
