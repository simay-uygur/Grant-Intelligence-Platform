import { describe, expect, it } from "vitest";
import { diffLines } from "./diffLines";

describe("diffLines", () => {
  it("returns every line as same when the texts are identical", () => {
    const text = "Line one\nLine two";
    expect(diffLines(text, text)).toEqual([
      { type: "same", text: "Line one" },
      { type: "same", text: "Line two" },
    ]);
  });

  it("marks every line removed/added when nothing overlaps", () => {
    expect(diffLines("Old paragraph.", "New paragraph.")).toEqual([
      { type: "removed", text: "Old paragraph." },
      { type: "added", text: "New paragraph." },
    ]);
  });

  it("keeps unchanged lines as same and flags only the changed one", () => {
    const oldText = "Opener.\n\nOriginal middle line.\n\nCloser.";
    const newText = "Opener.\n\nRevised middle line.\n\nCloser.";
    expect(diffLines(oldText, newText)).toEqual([
      { type: "same", text: "Opener." },
      { type: "same", text: "" },
      { type: "removed", text: "Original middle line." },
      { type: "added", text: "Revised middle line." },
      { type: "same", text: "" },
      { type: "same", text: "Closer." },
    ]);
  });

  it("handles an empty old text (pure addition)", () => {
    expect(diffLines("", "New content.")).toEqual([
      { type: "removed", text: "" },
      { type: "added", text: "New content." },
    ]);
  });

  it("handles an empty new text (pure removal)", () => {
    expect(diffLines("Old content.", "")).toEqual([
      { type: "removed", text: "Old content." },
      { type: "added", text: "" },
    ]);
  });

  it("reconstructs the old text from removed+same lines, in order", () => {
    const oldText = "A\nB\nC\nD";
    const newText = "A\nX\nC\nD";
    const diff = diffLines(oldText, newText);
    const reconstructedOld = diff
      .filter((l) => l.type === "same" || l.type === "removed")
      .map((l) => l.text)
      .join("\n");
    expect(reconstructedOld).toBe(oldText);
  });

  it("reconstructs the new text from added+same lines, in order", () => {
    const oldText = "A\nB\nC\nD";
    const newText = "A\nX\nC\nD";
    const diff = diffLines(oldText, newText);
    const reconstructedNew = diff
      .filter((l) => l.type === "same" || l.type === "added")
      .map((l) => l.text)
      .join("\n");
    expect(reconstructedNew).toBe(newText);
  });
});
