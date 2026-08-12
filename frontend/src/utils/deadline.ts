import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

function parseDeadline(value: string): Date | null {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function formatDeadline(value: string): string {
  const date = parseDeadline(value);
  return date ? format(date, "d MMM yyyy") : value;
}

/**
 * Deadline urgency, as tiers rather than a raw day count, so every surface
 * draws the same line in the same place:
 *
 *   overdue  the date has passed            → destructive
 *   urgent   0–7 calendar days remaining    → warning
 *   soon     8–30 days remaining            → neutral/muted
 *   normal   more than 30 days remaining    → no emphasis
 *   unknown  the value doesn't parse        → no emphasis
 *
 * Two rules this deliberately follows:
 *
 * - Colour never carries the meaning on its own. Every tier returns a text
 *   `label`, and callers must render it — a colour-blind user, or anyone
 *   reading a greyscale printout, gets the same information.
 * - `now` is a parameter, not a call to the clock inside the branch logic, so
 *   the tiers are pure and unit-testable without mocking time.
 *
 * `normal` and `unknown` return a label too (a caller may want to show it),
 * but the shared DeadlineBadge stays silent for them: a deadline months out
 * isn't news, and the absolute date is already displayed beside it.
 */
export type DeadlineTier = "overdue" | "urgent" | "soon" | "normal" | "unknown";

const URGENT_WITHIN_DAYS = 7;
const SOON_WITHIN_DAYS = 30;

export interface DeadlineStatus {
  tier: DeadlineTier;
  /** Calendar days until the deadline; negative once past, null if unparseable. */
  daysRemaining: number | null;
  /** Short human label. Always render this alongside any colour. */
  label: string;
}

export function deadlineStatus(value: string, now: Date = new Date()): DeadlineStatus {
  const date = parseDeadline(value);
  if (!date) {
    return { tier: "unknown", daysRemaining: null, label: "Deadline unavailable" };
  }

  const days = differenceInCalendarDays(date, now);

  if (days < 0) return { tier: "overdue", daysRemaining: days, label: "Closed" };

  const label =
    days === 0 ? "Closes today" : days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;

  if (days <= URGENT_WITHIN_DAYS) return { tier: "urgent", daysRemaining: days, label };
  if (days <= SOON_WITHIN_DAYS) return { tier: "soon", daysRemaining: days, label };
  return { tier: "normal", daysRemaining: days, label };
}
