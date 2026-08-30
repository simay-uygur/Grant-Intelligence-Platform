import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownMessage } from "./MarkdownMessage";

describe("MarkdownMessage", () => {
  it("renders assistant emphasis and numbered questions semantically", () => {
    render(
      <MarkdownMessage>{`**To start:**\n\n1. **What type of organisation are you?**\n2. **Which country are you based in?**`}</MarkdownMessage>,
    );

    expect(screen.getByText("To start:").tagName).toBe("STRONG");
    expect(screen.getByRole("list").textContent).toContain("What type of organisation are you?");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("does not interpret raw HTML from model output", () => {
    const { container } = render(
      <MarkdownMessage>{`<script>alert("no")</script>`}</MarkdownMessage>,
    );

    expect(container.querySelector("script")).toBeNull();
  });
});
