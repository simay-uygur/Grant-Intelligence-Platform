// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GrantResults } from "./GrantResults";
import type { Grant } from "@/types";

const discovered: Grant[] = [
  {
    id: "web-1",
    title: "Regional Innovation Voucher",
    description: "A regional funding source discovered by web search.",
    source: "Web Search",
    programme: "Web Grant Discovery",
    sourceUrl: "https://example.com/grant",
  },
  {
    id: "eu-1",
    title: "Horizon Digital Call",
    description: "An EU Portal candidate.",
    source: "EU Horizon API",
    programme: "Horizon Europe",
    sourceUrl: "https://example.com/eu",
  },
];

describe("GrantResults", () => {
  it("keeps discovered candidates visible when no strong recommendations are selected", () => {
    render(
      <GrantResults
        grants={[]}
        allCandidates={discovered}
        sourceSummary="Parallel search summary."
        onAsk={vi.fn()}
        onStart={vi.fn()}
        onRetryResearch={vi.fn()}
      />,
    );

    expect(screen.getByText("No strong recommendations selected")).toBeDefined();
    expect(screen.getByText("Regional Innovation Voucher")).toBeDefined();
    expect(screen.getByText("Horizon Digital Call")).toBeDefined();
    expect(screen.queryByText(/2 opportunities discovered/)).toBeNull();
    expect(screen.queryByText("No grants matched this profile")).toBeNull();
  });
});
