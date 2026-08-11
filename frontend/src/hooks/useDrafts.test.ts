import { describe, expect, it } from "vitest";
import type { DocumentSection } from "@/types";
import { computeRestore, hashText, type DraftEntry } from "./useDrafts";

const sections: DocumentSection[] = [
  { id: "summary", title: "Project Summary", content: "committed summary" },
  { id: "budget", title: "Budget Overview", content: "committed budget" },
];

/** A buffer entry written while the committed text was `base`. */
const entry = (text: string, base: string): DraftEntry => ({ text, baseHash: hashText(base) });

describe("hashText", () => {
  it("is stable for the same input", () => {
    expect(hashText("committed summary")).toBe(hashText("committed summary"));
  });

  it("differs when the text differs", () => {
    expect(hashText("committed summary")).not.toBe(hashText("committed summary "));
    expect(hashText("")).not.toBe(hashText("a"));
  });
});

describe("computeRestore", () => {
  it("returns null when there is nothing buffered", () => {
    expect(computeRestore({}, sections)).toBeNull();
  });

  it("drops a buffer that already matches the committed text", () => {
    // The user saved, so the buffer is redundant rather than unsaved work.
    const buffered = { summary: entry("committed summary", "committed summary") };
    expect(computeRestore(buffered, sections)).toBeNull();
  });

  it("restores text that differs, with no conflict when the base is unchanged", () => {
    const buffered = { summary: entry("my unsaved edit", "committed summary") };
    expect(computeRestore(buffered, sections)).toEqual({
      sections: { summary: "my unsaved edit" },
      conflictSectionIds: [],
    });
  });

  it("flags a conflict when the committed text moved on since the buffer was written", () => {
    // Buffer was based on older text; the section has been saved since.
    const buffered = { summary: entry("my unsaved edit", "an older committed summary") };
    expect(computeRestore(buffered, sections)).toEqual({
      sections: { summary: "my unsaved edit" },
      conflictSectionIds: ["summary"],
    });
  });

  it("restores the conflicted text rather than discarding either version", () => {
    const result = computeRestore({ summary: entry("mine", "stale base") }, sections);
    expect(result?.sections.summary).toBe("mine");
    expect(sections[0].content).toBe("committed summary");
  });

  it("reports conflicts per section, not per document", () => {
    const buffered = {
      summary: entry("edited summary", "committed summary"), // base intact
      budget: entry("edited budget", "stale budget"), // base moved on
    };
    const result = computeRestore(buffered, sections);
    expect(result?.sections).toEqual({
      summary: "edited summary",
      budget: "edited budget",
    });
    expect(result?.conflictSectionIds).toEqual(["budget"]);
  });

  it("skips buffered sections that no longer exist in the document", () => {
    const buffered = {
      summary: entry("edited summary", "committed summary"),
      "deleted-section": entry("orphan text", "whatever"),
    };
    const result = computeRestore(buffered, sections);
    expect(result?.sections).toEqual({ summary: "edited summary" });
  });

  it("returns null when the only buffered section is gone", () => {
    expect(computeRestore({ "deleted-section": entry("orphan", "base") }, sections)).toBeNull();
  });

  it("treats an emptied section as unsaved work, not as nothing", () => {
    // Clearing a section is a real edit; it must survive a reload.
    const buffered = { summary: entry("", "committed summary") };
    expect(computeRestore(buffered, sections)).toEqual({
      sections: { summary: "" },
      conflictSectionIds: [],
    });
  });
});
