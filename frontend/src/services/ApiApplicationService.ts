import { z } from "zod";
import type { ApplicationDocument, Grant, OrganisationProfile } from "@/types";
import type { ApplicationStatus, DemoApplication } from "@/data/mockApplications";
import type { ApplicationService, OpenedApplication } from "./ApplicationService";
import { ApiClient, ApiError, type SseEvent } from "./apiClient";

const documentSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
});

const applicationDocumentSchema = z.object({
  id: z.string().min(1),
  grantId: z.string().min(1),
  grantTitle: z.string().min(1),
  sections: z.array(documentSectionSchema),
  updatedAt: z.string(),
});

const organisationProfileSchema = z.object({
  organisationName: z.string(),
  organisationType: z.string(),
  organisationDescription: z.string(),
  country: z.string(),
  region: z.string(),
  projectTitle: z.string(),
  projectDescription: z.string(),
  sector: z.string(),
  fundingAmount: z.string(),
  projectStartDate: z.string(),
  projectDuration: z.string(),
  eligibilityConstraints: z.string(),
});

const grantSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    source: z.string().optional(),
    provenance: z.enum(["mock", "live"]).optional(),
    programme: z.string().optional(),
    matchPercentage: z.number().optional(),
    fundingAmount: z.string().optional(),
    deadline: z.string().optional(),
    eligibleCountries: z.array(z.string()).optional(),
    organisationEligibility: z.array(z.string()).optional(),
    fundingType: z.string().optional(),
    whyItMatches: z.string().optional(),
    matchReasons: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    sourceUrl: z.string().optional(),
  })
  .passthrough();

const rewriteSectionResponseSchema = z.object({
  sectionId: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
});

const applicationStatusSchema = z.enum([
  "drafting",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "archived",
]);

const pipelineStatusSchema = z.enum([
  "drafting",
  "submitted",
  "under_review",
  "approved",
  "rejected",
]);

const applicationSummarySchema = z.object({
  id: z.string().min(1),
  grantId: z.string().min(1),
  grantTitle: z.string().min(1),
  grantOrganisation: z.string(),
  applicantOrganisation: z.string(),
  status: applicationStatusSchema,
  fundingAmount: z.string(),
  deadline: z.string(),
  updatedAt: z.string(),
});

const applicationListResponseSchema = z.object({
  applications: z.array(applicationSummarySchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

const storedApplicationSchema = applicationDocumentSchema.extend({
  status: applicationStatusSchema,
  grant: z.record(z.unknown()).optional(),
  profile: z.record(z.unknown()).optional(),
  createdAt: z.string().optional(),
});

export class ApplicationApiContractError extends Error {
  constructor() {
    super("The application backend returned data in an unexpected format.");
    this.name = "ApplicationApiContractError";
  }
}

export class ApiApplicationService implements ApplicationService {
  private readonly client: ApiClient;

  constructor(baseUrl?: string, client?: ApiClient) {
    this.client = client ?? new ApiClient(baseUrl);
  }

  async listApplications(): Promise<DemoApplication[]> {
    const payload = await this.client.request<unknown>("/api/v1/applications");
    const result = applicationListResponseSchema.safeParse(payload);
    if (!result.success) throw new ApplicationApiContractError();
    return result.data.applications
      .filter((application) => application.status !== "archived")
      .map(toDemoApplication);
  }

  async getApplication(applicationId: string): Promise<OpenedApplication> {
    const payload = await this.client.request<unknown>(
      `/api/v1/applications/${encodeURIComponent(applicationId)}`,
    );
    const result = storedApplicationSchema.safeParse(payload);
    if (!result.success) throw new ApplicationApiContractError();
    const grant = grantSchema.safeParse(result.data.grant);
    const profile = organisationProfileSchema.safeParse(result.data.profile);
    return {
      document: toApplicationDocument(result.data),
      grant: grant.success ? (grant.data as Grant) : undefined,
      profile: profile.success ? (profile.data as OrganisationProfile) : undefined,
    };
  }

  async updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<DemoApplication> {
    const payload = await this.client.request<unknown>(
      `/api/v1/applications/${encodeURIComponent(applicationId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    );
    const result = storedApplicationSchema.safeParse(payload);
    if (!result.success) throw new ApplicationApiContractError();
    if (!pipelineStatusSchema.safeParse(result.data.status).success) {
      throw new ApplicationApiContractError();
    }
    return toDemoApplication({
      id: result.data.id,
      grantId: result.data.grantId,
      grantTitle: result.data.grantTitle,
      grantOrganisation: grantOrganisation(result.data.grant),
      applicantOrganisation: applicantOrganisation(result.data.profile),
      status: result.data.status,
      fundingAmount: fundingAmount(result.data.grant, result.data.profile),
      deadline: deadline(result.data.grant),
      updatedAt: result.data.updatedAt,
    });
  }

  async saveSection(applicationId: string, sectionId: string, content: string): Promise<void> {
    const payload = await this.client.request<unknown>(
      `/api/v1/applications/${encodeURIComponent(applicationId)}/sections/${encodeURIComponent(sectionId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ content }),
      },
    );
    const result = storedApplicationSchema.safeParse(payload);
    if (!result.success) throw new ApplicationApiContractError();
  }

  async findSavedApplication(grantId: string): Promise<ApplicationDocument | undefined> {
    try {
      const payload = await this.client.request<unknown>(
        `/api/v1/grants/${encodeURIComponent(grantId)}/applications/latest`,
      );
      const result = applicationDocumentSchema.safeParse(payload);
      if (!result.success) throw new ApplicationApiContractError();
      return toApplicationDocument(result.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined;
      throw error;
    }
  }

  async startApplication(
    grant: Grant,
    profile: OrganisationProfile,
    onProgress?: (event: SseEvent) => void,
  ): Promise<ApplicationDocument> {
    const payload = await this.client.requestSse<unknown>(
      `/api/v1/grants/${encodeURIComponent(grant.id)}/start-application/stream`,
      {
        method: "POST",
        body: JSON.stringify({ grant, profile }),
      },
      onProgress,
    );
    const rawDocument =
      typeof payload === "object" && payload !== null && "document" in payload
        ? (payload as { document: unknown }).document
        : payload;
    const result = applicationDocumentSchema.safeParse(rawDocument);
    if (!result.success) throw new ApplicationApiContractError();
    return toApplicationDocument(result.data);
  }

  async rewriteSection(
    sectionTitle: string,
    currentContent: string,
    profile: OrganisationProfile,
    grant: Grant | undefined,
    documentId?: string,
    onProgress?: (event: SseEvent) => void,
  ): Promise<string> {
    const sectionId = sectionTitle.toLowerCase().replace(/\s+/g, "-");
    const storedDocumentId = documentId ?? grant?.id ?? "active-document";
    const payload = await this.client.requestSse<unknown>(
      `/api/v1/documents/${encodeURIComponent(storedDocumentId)}/sections/${encodeURIComponent(sectionId)}/stream`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sectionTitle,
          currentContent,
          profile,
          grant,
        }),
      },
      onProgress,
    );
    const result = rewriteSectionResponseSchema.safeParse(payload);
    if (!result.success) throw new ApplicationApiContractError();
    return result.data.content;
  }
}

function toApplicationDocument(
  application: z.infer<typeof applicationDocumentSchema>,
): ApplicationDocument {
  return {
    id: application.id,
    grantId: application.grantId,
    grantTitle: application.grantTitle,
    sections: application.sections,
    updatedAt: application.updatedAt,
  };
}

function toDemoApplication(application: z.infer<typeof applicationSummarySchema>): DemoApplication {
  const status = pipelineStatusSchema.safeParse(application.status);
  if (!status.success) throw new ApplicationApiContractError();
  return {
    id: application.id,
    grantId: application.grantId,
    grantTitle: application.grantTitle,
    grantOrganisation: application.grantOrganisation,
    applicantOrganisation: application.applicantOrganisation,
    status: status.data,
    fundingAmount: application.fundingAmount,
    deadline: application.deadline,
    updatedAt: application.updatedAt,
  };
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function grantOrganisation(grant: Record<string, unknown> | undefined): string {
  return (
    stringField(grant, "programme") ??
    stringField(grant, "source") ??
    stringField(grant, "fundingType") ??
    "Unknown funder"
  );
}

function applicantOrganisation(profile: Record<string, unknown> | undefined): string {
  return stringField(profile, "organisationName") ?? "Unknown applicant";
}

function fundingAmount(
  grant: Record<string, unknown> | undefined,
  profile: Record<string, unknown> | undefined,
): string {
  return (
    stringField(grant, "fundingAmount") ??
    stringField(grant, "amount") ??
    stringField(profile, "fundingAmount") ??
    "Not specified"
  );
}

function deadline(grant: Record<string, unknown> | undefined): string {
  return stringField(grant, "deadline") ?? "";
}
