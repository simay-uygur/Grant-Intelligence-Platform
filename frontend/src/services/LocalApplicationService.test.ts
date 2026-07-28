import { expect, test } from "bun:test";
import type { Grant, OrganisationProfile } from "../types";
import { LocalApplicationService } from "./LocalApplicationService";

test("creates a local draft from a minimal live grant", async () => {
  const grant: Grant = {
    id: "HORIZON-1",
    source: "eu_horizon",
    provenance: "live",
    title: "Live AI opportunity",
    description: "A minimal live record",
  };
  const profile: OrganisationProfile = {
    organisationName: "Northlight Robotics",
    organisationType: "SME",
    organisationDescription: "",
    country: "Germany",
    region: "",
    projectTitle: "AI inspection",
    projectDescription: "",
    sector: "AI",
    fundingAmount: "EUR 500 000",
    projectStartDate: "",
    projectDuration: "24 months",
    eligibilityConstraints: "",
  };

  const document = await new LocalApplicationService().startApplication(grant, profile);

  expect(document.grantId).toBe(grant.id);
  expect(document.sections.length).toBeGreaterThan(0);
  expect(document.sections.map((section) => section.content).join("\n")).not.toContain(
    "undefined",
  );
  expect(document.sections.map((section) => section.content).join("\n")).toContain(
    "eu_horizon",
  );
});
