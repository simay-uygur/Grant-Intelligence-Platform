import { z } from "zod";
import type { Grant, OrganisationProfile } from "@/types";

export const grantSearchRequestSchema = z.object({
  query: z.string().min(1),
  organisationName: z.string().min(1).optional(),
  organisationType: z.string().min(1).optional(),
  organisationDescription: z.string().min(1).optional(),
  sector: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  projectTitle: z.string().min(1).optional(),
  projectDescription: z.string().min(1).optional(),
  fundingAmount: z.string().min(1).optional(),
  projectStartDate: z.string().min(1).optional(),
  projectDuration: z.string().min(1).optional(),
  eligibilityConstraints: z.string().min(1).optional(),
  organization_type: z.string().min(1).optional(),
  only_open: z.boolean(),
  limit: z.number().int().min(1).max(25),
  excluded_grant_ids: z.array(z.string()).optional().default([]),
});

const grantResultDtoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  source: z.string().min(1).nullable().optional(),
  summary: z.string().nullable().optional(),
  programme: z.string().nullable().optional(),
  matchPercentage: z.number().nullable().optional(),
  fundingAmount: z.string().nullable().optional(),
  eligibleCountries: z.array(z.string()).optional(),
  organisationEligibility: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  fundingType: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  whyItMatches: z.string().nullable().optional(),
  matchReasons: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().nullable().optional(),
  amount: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  match_explanation: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});

export const grantSearchResponseSchema = z.object({
  grants: z.array(grantResultDtoSchema),
  source_summary: z
    .string()
    .optional()
    .default("Results come from the EU Horizon API (EU Funding & Tenders Portal)."),
  normalized_filters_applied: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]))
    .optional()
    .default({}),
});

export type GrantSearchRequestDto = z.infer<typeof grantSearchRequestSchema>;
export type GrantSearchResponseDto = z.infer<typeof grantSearchResponseSchema>;
export type GrantResultDto = z.infer<typeof grantResultDtoSchema>;

export class GrantApiContractError extends Error {
  constructor() {
    super("The grant backend returned data in an unexpected format.");
    this.name = "GrantApiContractError";
  }
}

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export function buildGrantSearchRequest(
  profile: OrganisationProfile,
  excludedGrantIds?: string[],
): GrantSearchRequestDto {
  const primaryQuery = [clean(profile.projectTitle), clean(profile.sector)]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const query =
    primaryQuery ||
    clean(profile.projectDescription) ||
    clean(profile.organisationDescription) ||
    clean(profile.organisationName) ||
    "Horizon Europe";

  return grantSearchRequestSchema.parse({
    query,
    organisationName: clean(profile.organisationName),
    organisationType: clean(profile.organisationType),
    organisationDescription: clean(profile.organisationDescription),
    sector: clean(profile.sector),
    country: clean(profile.country),
    region: clean(profile.region),
    projectTitle: clean(profile.projectTitle),
    projectDescription: clean(profile.projectDescription),
    fundingAmount: clean(profile.fundingAmount),
    projectStartDate: clean(profile.projectStartDate),
    projectDuration: clean(profile.projectDuration),
    eligibilityConstraints: clean(profile.eligibilityConstraints),
    organization_type: clean(profile.organisationType),
    only_open: true,
    limit: 3,
    excluded_grant_ids: excludedGrantIds ?? [],
  });
}

export function mapGrantResult(dto: GrantResultDto): Grant {
  const organisationEligibility = Array.isArray(dto.organisationEligibility)
    ? dto.organisationEligibility
    : clean(dto.organisationEligibility ?? undefined)
      ? [clean(dto.organisationEligibility ?? undefined) as string]
      : undefined;

  return {
    id: dto.id,
    source: clean(dto.source ?? undefined),
    title: dto.title,
    description:
      clean(dto.description ?? undefined) ??
      clean(dto.summary ?? undefined) ??
      "No description returned by the backend.",
    provenance: "live",
    programme: clean(dto.programme ?? undefined),
    matchPercentage: dto.matchPercentage ?? undefined,
    fundingAmount: clean(dto.fundingAmount ?? dto.amount ?? undefined),
    deadline: clean(dto.deadline ?? undefined),
    eligibleCountries: dto.eligibleCountries,
    organisationEligibility,
    fundingType: clean(dto.fundingType ?? undefined),
    whyItMatches: clean(dto.whyItMatches ?? dto.match_explanation ?? undefined),
    matchReasons: dto.matchReasons,
    requirements: dto.requirements,
    tags: dto.tags,
    sourceUrl: clean(dto.sourceUrl ?? dto.url ?? undefined),
  };
}

export function parseGrantSearchResponse(input: unknown): GrantSearchResponseDto {
  const result = grantSearchResponseSchema.safeParse(input);
  if (!result.success) throw new GrantApiContractError();
  return result.data;
}
