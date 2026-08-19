import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import type { Conversation } from "@/types";

const sampleConversations: Conversation[] = [
  {
    id: "c-1",
    title: "AI Grant Research",
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
    stage: "welcome",
    messages: [],
  },
];

describe("Sidebar Component Integration", () => {
  it("renders main view navigation options", () => {
    render(
      <Sidebar
        conversations={sampleConversations}
        activeId="c-1"
        mainView="chat"
        isMockMode={true}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onSelectView={vi.fn()}
      />,
    );

    expect(screen.getByText("Grant Intelligence")).toBeDefined();
    expect(screen.getByRole("button", { name: /Chat/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Pipeline/i })).toBeDefined();
  });

  it("calls onSelectView when Pipeline button is clicked", () => {
    const handleSelectView = vi.fn();
    render(
      <Sidebar
        conversations={sampleConversations}
        activeId="c-1"
        mainView="chat"
        isMockMode={true}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onSelectView={handleSelectView}
      />,
    );

    const pipelineBtn = screen.getByRole("button", { name: /Pipeline/i });
    fireEvent.click(pipelineBtn);

    expect(handleSelectView).toHaveBeenCalledWith("pipeline");
  });

  it("calls onNew when New conversation button is clicked", () => {
    const handleNew = vi.fn();
    render(
      <Sidebar
        conversations={sampleConversations}
        activeId="c-1"
        mainView="chat"
        isMockMode={true}
        onSelect={vi.fn()}
        onNew={handleNew}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onSelectView={vi.fn()}
      />,
    );

    const newBtn = screen.getByRole("button", { name: /New conversation/i });
    fireEvent.click(newBtn);

    expect(handleNew).toHaveBeenCalledTimes(1);
  });
});
