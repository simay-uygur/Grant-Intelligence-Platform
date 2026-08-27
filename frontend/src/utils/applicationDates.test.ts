import { describe, expect, it } from "vitest";
import { applicationWrittenLabel } from "./applicationDates";

describe("applicationWrittenLabel", () => {
  it("shows both relative and exact dates for a reopened application", () => {
    const label = applicationWrittenLabel(
      {
        createdAt: "2026-08-22T18:59:08Z",
        updatedAt: "2026-08-23T10:00:00Z",
      },
      new Date("2026-08-27T18:59:08Z"),
    );

    expect(label).toMatch(/^Application written 5 days ago \(Aug 22, 2026 at \d{2}:\d{2}\)\.$/);
  });

  it("falls back to the update time for documents created by older builds", () => {
    const label = applicationWrittenLabel(
      { updatedAt: "2026-08-26T18:59:08Z" },
      new Date("2026-08-27T18:59:08Z"),
    );

    expect(label).toContain("Application written 1 day ago");
  });

  it("does not print a misleading date when the stored value is invalid", () => {
    expect(applicationWrittenLabel({ updatedAt: "not-a-date" })).toBeNull();
  });
});
