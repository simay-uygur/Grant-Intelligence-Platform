import { z } from "zod";
import type { Grant, OrganisationProfile } from "@/types";

export const grantSearchRequestSchema = z.object({
  query: z.string().min(1),
  country: z.string().min(1).optional(),
  organization_type: z.string().min(1).optional(),
  only_open: z.boolean(),
  limit: z.number().int().min(1).max(25),
});

const grantResultDtoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  source: z.string().min(1),
  summary: z.string(),
  amount: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  match_explanation: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});

export const grantSearchResponseSchema = z.object({
  grants: z.array(grantResultDtoSchema),
  source_summary: z.string(),
  normalized_filters_applied: z.record(
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
  ),
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

export function buildGrantSearchRequest(profile: OrganisationProfile): GrantSearchRequestDto {
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
    country: clean(profile.country),
    organization_type: clean(profile.organisationType),
    only_open: true,
    limit: 3,
  });
}

export function mapGrantResult(dto: GrantResultDto): Grant {
  return {
    id: dto.id,
    source: dto.source,
    title: dto.title,
    description: dto.summary,
    provenance: "live",
    fundingAmount: clean(dto.amount ?? undefined),
    deadline: clean(dto.deadline ?? undefined),
    whyItMatches: clean(dto.match_explanation ?? undefined),
    sourceUrl: clean(dto.url ?? undefined),
  };
}

export function parseGrantSearchResponse(input: unknown): GrantSearchResponseDto {
  const result = grantSearchResponseSchema.safeParse(input);
  if (!result.success) throw new GrantApiContractError();
  return result.data;
}
