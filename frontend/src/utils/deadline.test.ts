import { describe, expect, it } from "vitest";
import { deadlineStatus, formatDeadline } from "./deadline";

// Fixed reference point: every case injects `now`, so these assertions mean
// the same thing in 2027 as they do today and don't depend on the CI clock.
//
// Built from local parts rather than an ISO/UTC string on purpose. parseISO()
// resolves a date-only deadline to LOCAL midnight and the helper compares
// local calendar days — which is the right semantic for "the call closes on
// the 20th" — so a UTC fixture would shift a day for any runner east or west
// of UTC and make these tests flaky by timezone. (Month is 0-indexed: 7 = August.)
const NOW = new Date(2026, 7, 7, 12, 0, 0);

describe("deadlineStatus", () => {
  it("treats a past deadline as overdue", () => {
    expect(deadlineStatus("2026-08-06", NOW)).toEqual({
      tier: "overdue",
      daysRemaining: -1,
      label: "Closed",
    });
  });

  it("labels today and tomorrow by name rather than a day count", () => {
    expect(deadlineStatus("2026-08-07", NOW)).toEqual({
      tier: "urgent",
      daysRemaining: 0,
      label: "Closes today",
    });
    expect(deadlineStatus("2026-08-08", NOW)).toEqual({
      tier: "urgent",
      daysRemaining: 1,
      label: "Closes tomorrow",
    });
  });

  it("counts days for the rest of the urgent tier", () => {
    expect(deadlineStatus("2026-08-09", NOW)).toMatchObject({
      tier: "urgent",
      label: "Closes in 2 days",
    });
  });

  // The boundaries are the whole point of the tier split, so they are pinned
  // on both sides: 7 is still urgent, 8 is soon, 30 is soon, 31 is normal.
  it("puts the urgent/soon boundary between 7 and 8 days", () => {
    expect(deadlineStatus("2026-08-14", NOW)).toMatchObject({ tier: "urgent", daysRemaining: 7 });
    expect(deadlineStatus("2026-08-15", NOW)).toMatchObject({ tier: "soon", daysRemaining: 8 });
  });

  it("puts the soon/normal boundary between 30 and 31 days", () => {
    expect(deadlineStatus("2026-09-06", NOW)).toMatchObject({ tier: "soon", daysRemaining: 30 });
    expect(deadlineStatus("2026-09-07", NOW)).toMatchObject({ tier: "normal", daysRemaining: 31 });
  });

  it("still returns a label for the normal tier, for callers that want one", () => {
    expect(deadlineStatus("2026-09-20", NOW)).toEqual({
      tier: "normal",
      daysRemaining: 44,
      label: "Closes in 44 days",
    });
  });

  it("reports unparseable input as unknown instead of throwing", () => {
    expect(deadlineStatus("not-a-date", NOW)).toEqual({
      tier: "unknown",
      daysRemaining: null,
      label: "Deadline unavailable",
    });
    expect(deadlineStatus("", NOW)).toMatchObject({ tier: "unknown", daysRemaining: null });
  });

  it("compares calendar days, not elapsed hours", () => {
    // Late in the day, "tomorrow" is under 24h away but still one calendar day.
    const lateEvening = new Date(2026, 7, 7, 23, 30);
    expect(deadlineStatus("2026-08-08", lateEvening)).toMatchObject({
      daysRemaining: 1,
      label: "Closes tomorrow",
    });
  });
});

describe("formatDeadline", () => {
  it("formats a valid ISO date for display", () => {
    expect(formatDeadline("2026-09-20")).toBe("20 Sep 2026");
  });

  it("passes unparseable values through untouched", () => {
    expect(formatDeadline("rolling deadline")).toBe("rolling deadline");
  });
});
