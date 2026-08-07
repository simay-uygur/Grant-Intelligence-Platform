import { z } from "zod";
import type { ApplicationDocument, Grant, OrganisationProfile } from "@/types";
import type { ApplicationService } from "./ApplicationService";
import { ApiClient } from "./apiClient";

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

const rewriteSectionResponseSchema = z.object({
  sectionId: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
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

  async startApplication(grant: Grant, profile: OrganisationProfile): Promise<ApplicationDocument> {
    const payload = await this.client.request<unknown>(
      `/api/v1/grants/${encodeURIComponent(grant.id)}/start-application`,
      {
        method: "POST",
        body: JSON.stringify({ grant, profile }),
      },
    );
    const result = applicationDocumentSchema.safeParse(payload);
    if (!result.success) throw new ApplicationApiContractError();
    return result.data;
  }

  async rewriteSection(
    sectionTitle: string,
    currentContent: string,
    profile: OrganisationProfile,
    grant: Grant | undefined,
  ): Promise<string> {
    const sectionId = sectionTitle.toLowerCase().replace(/\s+/g, "-");
    const documentId = grant?.id ?? "active-document";
    const payload = await this.client.request<unknown>(
      `/api/v1/documents/${encodeURIComponent(documentId)}/sections/${encodeURIComponent(sectionId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sectionTitle,
          currentContent,
          profile,
          grant,
        }),
      },
    );
    const result = rewriteSectionResponseSchema.safeParse(payload);
    if (!result.success) throw new ApplicationApiContractError();
    return result.data.content;
  }
}
