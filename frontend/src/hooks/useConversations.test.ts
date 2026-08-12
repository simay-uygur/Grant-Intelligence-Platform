import { describe, expect, it } from "vitest";
import type { Conversation } from "@/types";
import { applyRename } from "./useConversations";

function conversation(id: string, title: string): Conversation {
  return {
    id,
    title,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-02T10:30:00.000Z",
    stage: "results",
    messages: [{ id: `${id}-m1`, role: "user", createdAt: "2026-08-01T09:00:00.000Z", blocks: [] }],
    selectedGrantId: "digital-europe",
  };
}

const list = (): Conversation[] => [
  conversation("a", "First conversation"),
  conversation("b", "Second conversation"),
  conversation("c", "Third conversation"),
];

describe("applyRename", () => {
  it("changes the target's title", () => {
    const before = list();
    const after = applyRename(before, "b", "Renamed");
    expect(after.find((c) => c.id === "b")?.title).toBe("Renamed");
  });

  // The core data-safety property: a rename may touch nothing else.
  it("changes ONLY the title field of the target", () => {
    const before = list();
    const target = before.find((c) => c.id === "b")!;
    const after = applyRename(before, "b", "Renamed");
    const renamed = after.find((c) => c.id === "b")!;

    expect(renamed).toEqual({ ...target, title: "Renamed" });
    // updatedAt in particular must not move: a rename is not activity.
    expect(renamed.updatedAt).toBe(target.updatedAt);
    expect(renamed.createdAt).toBe(target.createdAt);
    expect(renamed.messages).toBe(target.messages);
    expect(renamed.stage).toBe(target.stage);
    expect(renamed.selectedGrantId).toBe(target.selectedGrantId);
  });

  it("preserves every other conversation by reference", () => {
    const before = list();
    const after = applyRename(before, "b", "Renamed");
    // Same object identity ⇒ identical JSON ⇒ byte-for-byte in storage.
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
  });

  it("keeps order and length", () => {
    const after = applyRename(list(), "b", "Renamed");
    expect(after.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("serialises identically for untouched conversations", () => {
    const before = list();
    const after = applyRename(before, "b", "Renamed");
    expect(JSON.stringify(after.filter((c) => c.id !== "b"))).toBe(
      JSON.stringify(before.filter((c) => c.id !== "b")),
    );
  });

  // Returning the same array reference matters: the persist effect is keyed
  // on `conversations`, so an unchanged reference means no write at all.
  it("returns the same array for a blank title, keeping the old one", () => {
    const before = list();
    expect(applyRename(before, "b", "")).toBe(before);
    expect(applyRename(before, "b", "   ")).toBe(before);
    expect(applyRename(before, "b", "\n\t ")).toBe(before);
    expect(before.find((c) => c.id === "b")?.title).toBe("Second conversation");
  });

  it("returns the same array when the title is unchanged", () => {
    const before = list();
    expect(applyRename(before, "b", "Second conversation")).toBe(before);
    // Trimming means a whitespace-padded no-op is still a no-op.
    expect(applyRename(before, "b", "  Second conversation  ")).toBe(before);
  });

  it("returns the same array for an unknown id", () => {
    const before = list();
    expect(applyRename(before, "missing", "Renamed")).toBe(before);
  });

  it("trims surrounding whitespace before storing", () => {
    const after = applyRename(list(), "a", "  Padded title  ");
    expect(after.find((c) => c.id === "a")?.title).toBe("Padded title");
  });

  it("caps an over-long title at 200 characters with no trailing space", () => {
    const after = applyRename(list(), "a", "x".repeat(500));
    const title = after.find((c) => c.id === "a")!.title;
    expect(title).toHaveLength(200);

    const cutMidSpace = applyRename(list(), "a", `${"y".repeat(199)} tail`);
    expect(cutMidSpace.find((c) => c.id === "a")!.title).toBe("y".repeat(199));
  });

  it("does not mutate the input array", () => {
    const before = list();
    const snapshot = JSON.stringify(before);
    applyRename(before, "b", "Renamed");
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
