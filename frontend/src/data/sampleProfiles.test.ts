import { describe, expect, test } from "vitest";
import type { OrganisationProfile } from "@/types";
import { SAMPLE_PROFILES } from "./sampleProfiles";

const REQUIRED_FIELDS: (keyof OrganisationProfile)[] = [
  "organisationName",
  "organisationType",
  "country",
  "sector",
  "projectTitle",
  "projectDescription",
  "fundingAmount",
  "projectDuration",
];

describe("sample grant profiles", () => {
  test("has unique selectable profiles with all required form fields", () => {
    expect(new Set(SAMPLE_PROFILES.map(({ id }) => id)).size).toBe(SAMPLE_PROFILES.length);

    for (const { profile } of SAMPLE_PROFILES) {
      for (const field of REQUIRED_FIELDS) {
        expect(profile[field].trim()).toBeTruthy();
      }
    }
  });
});
