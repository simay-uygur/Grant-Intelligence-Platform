// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OrganisationForm } from "./OrganisationForm";

describe("OrganisationForm Component Integration", () => {
  it("renders step 1 with organisation inputs", () => {
    const handleSubmit = vi.fn();
    render(<OrganisationForm onSubmit={handleSubmit} />);

    expect(screen.getByText("Tell me about your organisation")).toBeDefined();
    expect(screen.getByLabelText(/Organisation name/i)).toBeDefined();
  });

  it("updates input fields and calls onSubmit when step 3 completes", async () => {
    const handleSubmit = vi.fn();
    render(
      <OrganisationForm
        initial={{
          organisationName: "Acme Tech",
          organisationType: "SME",
          country: "Austria",
          sector: "Digital & AI",
          projectTitle: "AI Grants Assistant",
          projectDescription: "An AI system for automated grant finding",
          fundingAmount: "€100,000 – €500,000",
          projectDuration: "12 months",
        }}
        onSubmit={handleSubmit}
      />,
    );

    // Step 1: Click Continue
    const continueBtn1 = screen.getByRole("button", { name: /Continue/i });
    fireEvent.click(continueBtn1);

    // Step 2: Click Continue
    const continueBtn2 = screen.getByRole("button", { name: /Continue/i });
    fireEvent.click(continueBtn2);

    // Step 3: Click Research matching grants
    const submitBtn = screen.getByRole("button", { name: /Research matching grants/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationName: "Acme Tech",
        projectTitle: "AI Grants Assistant",
      }),
    );
  });
});
