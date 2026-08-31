// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResearchStatus } from "./ResearchStatus";
import type { ResearchState } from "@/types";

describe("ResearchStatus component", () => {
  it("renders truthful found counts when present", () => {
    const state: ResearchState = {
      steps: [
        { label: "Generating keywords", status: "done" },
        {
          label: "Parallel multi-source search",
          status: "active",
          euCount: 7,
          webCount: 3,
        },
        { label: "Evaluating matches", status: "pending" },
      ],
    };

    render(<ResearchStatus state={state} />);

    expect(screen.getByText("+7")).toBeDefined();
    expect(screen.getByText("+3")).toBeDefined();
  });

  it("does not render fake fallback counts (14, 8) when counts are undefined", () => {
    const state: ResearchState = {
      steps: [
        { label: "Generating keywords", status: "done" },
        {
          label: "Parallel multi-source search",
          status: "active",
        },
        { label: "Evaluating matches", status: "pending" },
      ],
    };

    render(<ResearchStatus state={state} />);

    expect(screen.queryByText("+14")).toBeNull();
    expect(screen.queryByText("+8")).toBeNull();
  });
});
