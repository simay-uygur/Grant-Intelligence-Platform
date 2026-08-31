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
          label: "Discovering opportunities in parallel",
          status: "active",
        },
        { label: "Evaluating matches", status: "pending" },
      ],
      sources: {
        eu_portal: {
          id: "eu_portal",
          label: "EU Portal",
          detail: "Horizon Europe / SEDIA",
          status: "active",
          candidateCount: 7,
        },
        web_discovery: {
          id: "web_discovery",
          label: "Web Discovery",
          detail: "National & regional funding sources",
          status: "active",
          candidateCount: 3,
        },
      },
    };

    render(<ResearchStatus state={state} />);

    expect(screen.getByText("EU Portal")).toBeDefined();
    expect(screen.getByText("Web Discovery")).toBeDefined();
    expect(screen.getByText("7 candidates")).toBeDefined();
    expect(screen.getByText("3 candidates")).toBeDefined();
  });

  it("does not render fake fallback counts (14, 8) when counts are undefined", () => {
    const state: ResearchState = {
      steps: [
        { label: "Generating keywords", status: "done" },
        {
          label: "Discovering opportunities in parallel",
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
