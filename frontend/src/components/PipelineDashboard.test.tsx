// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PipelineDashboard } from "./PipelineDashboard";
import type { DemoApplication } from "@/data/mockApplications";

const sampleApplications: DemoApplication[] = [
  {
    id: "app-1",
    grantId: "g-1",
    grantTitle: "AI Innovation Fund",
    grantOrganisation: "Horizon Europe",
    applicantOrganisation: "Acme Labs",
    status: "drafting",
    updatedAt: "2026-03-01T12:00:00Z",
    fundingAmount: "€500,000",
    deadline: "2026-12-31",
  },
  {
    id: "app-2",
    grantId: "g-2",
    grantTitle: "Green Energy Transition",
    grantOrganisation: "EIC Accelerator",
    applicantOrganisation: "Acme Labs",
    status: "submitted",
    updatedAt: "2026-02-15T12:00:00Z",
    fundingAmount: "€1,200,000",
    deadline: "2026-11-30",
  },
];

describe("PipelineDashboard Component Integration", () => {
  it("renders pipeline columns and application cards", () => {
    render(
      <PipelineDashboard
        applications={sampleApplications}
        hydrated={true}
        persistenceOk={true}
        onGoToChat={vi.fn()}
        updateStatus={vi.fn()}
        conversations={[]}
        onOpenConversation={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Drafting").length).toBeGreaterThan(0);
    expect(screen.getByText("AI Innovation Fund")).toBeDefined();
    expect(screen.getByText("Green Energy Transition")).toBeDefined();
  });

  it("opens details sheet when card title is clicked", async () => {
    const handleOpenConv = vi.fn();
    render(
      <PipelineDashboard
        applications={sampleApplications}
        hydrated={true}
        persistenceOk={true}
        onGoToChat={vi.fn()}
        updateStatus={vi.fn()}
        conversations={[]}
        onOpenConversation={handleOpenConv}
      />,
    );

    const titleButton = screen.getByRole("button", {
      name: "View AI Innovation Fund application details",
    });
    expect(titleButton).toBeDefined();
    await act(async () => {
      fireEvent.click(titleButton);
    });

    expect(screen.getByRole("dialog")).toBeDefined();
  });
});
