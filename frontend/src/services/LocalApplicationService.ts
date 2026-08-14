import type { ApplicationDocument, DocumentSection, Grant, OrganisationProfile } from "@/types";
import {
  MOCK_APPLICATIONS,
  type ApplicationStatus,
  type DemoApplication,
} from "@/data/mockApplications";
import type { ApplicationService, OpenedApplication } from "./ApplicationService";
import { isMockScenario } from "./mockScenario";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const KEY_APPLICATIONS = "gi.applications.v1";

const grantContext = (grant: Grant): string =>
  grant.programme?.trim() || grant.source?.trim() || grant.title;

function makeSections(grant: Grant, profile: OrganisationProfile): DocumentSection[] {
  const org = profile.organisationName || "Our organisation";
  const project = profile.projectTitle || "the proposed project";
  const programme = grantContext(grant);
  return [
    {
      id: "organisation-overview",
      title: "Organisation Overview",
      content:
        `${org} is a ${profile.organisationType || "European organisation"} based in ${profile.region ? `${profile.region}, ` : ""}${profile.country || "the EU"}, active in the ${profile.sector || "target"} sector. ${profile.organisationDescription || ""}`.trim(),
    },
    {
      id: "project-summary",
      title: "Project Summary",
      content:
        `${project} seeks ${profile.fundingAmount || "targeted funding"} under ${programme} to deliver a ${profile.projectDuration || "multi-month"} initiative starting ${profile.projectStartDate || "in the next quarter"}. ${profile.projectDescription || ""}`.trim(),
    },
    {
      id: "problem-statement",
      title: "Problem Statement",
      content: `The ${profile.sector || "target"} sector in ${profile.country || "Europe"} faces persistent barriers to adoption, scale, and cross-border collaboration. Without targeted intervention these gaps limit competitiveness and public value.`,
    },
    {
      id: "proposed-solution",
      title: "Proposed Solution",
      content: `${org} will deliver ${project} through a structured programme combining research, technology deployment, stakeholder engagement, and measurable outcomes aligned with the ${programme} priorities.`,
    },
    {
      id: "innovation",
      title: "Innovation",
      content: `The project advances the state of the art by combining domain expertise in ${profile.sector || "the target sector"} with modern methodologies, producing replicable outputs that go beyond current practice in ${profile.country || "the region"}.`,
    },
    {
      id: "objectives",
      title: "Objectives",
      content: `1. Deliver measurable outcomes for beneficiaries in ${profile.country || "the target country"}.\n2. Build durable partnerships across the value chain.\n3. Produce open, reusable outputs aligned with ${programme} KPIs.\n4. Ensure long-term uptake and replication.`,
    },
    {
      id: "expected-impact",
      title: "Expected Impact",
      content: `${project} is expected to generate measurable economic, social, and environmental impact for ${org} and its ecosystem, contributing to the objectives of ${programme} and to the European Green and Digital agendas.`,
    },
    {
      id: "sustainability",
      title: "Sustainability",
      content: `Beyond the funded period, ${org} will sustain the results through operational integration, follow-on funding, and partnerships that ensure continued impact for at least three years after project end.`,
    },
    {
      id: "implementation-plan",
      title: "Implementation Plan",
      content:
        "The work is organised into five interlinked work packages covering management, research, technology development, piloting, and dissemination. Each work package has clear deliverables, milestones, and responsible partners.",
    },
    {
      id: "timeline",
      title: "Timeline",
      content: `Estimated project duration: ${profile.projectDuration || "24 months"}, starting ${profile.projectStartDate || "on award"}. Key milestones are scheduled at months 6, 12, 18, and at project close.`,
    },
    {
      id: "budget-overview",
      title: "Budget Overview",
      content: `Total requested budget: ${profile.fundingAmount || "as per grant envelope"}. The budget is distributed across personnel, subcontracting, equipment, travel, and other direct costs in line with ${programme} eligibility rules.`,
    },
    {
      id: "risk-management",
      title: "Risk Management",
      content:
        "Principal risks include technology adoption, partner availability, and regulatory change. Each is monitored with defined mitigation actions, owners, and review points throughout the project lifecycle.",
    },
  ];
}

export class LocalApplicationService implements ApplicationService {
  async listApplications(): Promise<DemoApplication[]> {
    await wait(50);
    const stored = readLocalApplications();
    if (stored) return stored;
    writeLocalApplications(MOCK_APPLICATIONS);
    return MOCK_APPLICATIONS;
  }

  async getApplication(applicationId: string): Promise<OpenedApplication> {
    await wait(100);
    const applications = readLocalApplications() ?? MOCK_APPLICATIONS;
    const application = applications.find((item) => item.id === applicationId);
    if (!application) throw new Error(`Application '${applicationId}' does not exist.`);
    return {
      document: {
        id: application.id,
        grantId: application.grantId,
        grantTitle: application.grantTitle,
        updatedAt: application.updatedAt,
        sections: [
          {
            id: "application-summary",
            title: "Application Summary",
            content: `${application.applicantOrganisation} is preparing an application for ${application.grantTitle} through ${application.grantOrganisation}.`,
          },
          {
            id: "funding-and-deadline",
            title: "Funding and Deadline",
            content: `Funding requested: ${application.fundingAmount}\nDeadline: ${application.deadline}`,
          },
          {
            id: "pipeline-status",
            title: "Pipeline Status",
            content: `Current status: ${application.status.replace(/_/g, " ")}. This local demo document is generated from the pipeline card.`,
          },
        ],
      },
      grant: {
        id: application.grantId,
        title: application.grantTitle,
        description: `${application.grantOrganisation} application tracked in the local pipeline.`,
        programme: application.grantOrganisation,
        fundingAmount: application.fundingAmount,
        deadline: application.deadline,
        provenance: "mock",
      },
    };
  }

  async updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<DemoApplication> {
    const applications = readLocalApplications() ?? MOCK_APPLICATIONS;
    const updatedAt = new Date().toISOString();
    const updated = applications.map((application) =>
      application.id === applicationId ? { ...application, status, updatedAt } : application,
    );
    writeLocalApplications(updated);
    const application = updated.find((item) => item.id === applicationId);
    if (!application) throw new Error(`Application '${applicationId}' does not exist.`);
    return application;
  }

  async upsertApplicationSummary(application: DemoApplication): Promise<void> {
    await wait(50);
    const applications = readLocalApplications() ?? MOCK_APPLICATIONS;
    writeLocalApplications(upsertLocalApplication(applications, application));
  }

  async saveSection(_applicationId: string, _sectionId: string, _content: string): Promise<void> {
    await wait(50);
  }

  async findSavedApplication(_grantId: string): Promise<ApplicationDocument | undefined> {
    return undefined;
  }

  async startApplication(grant: Grant, profile: OrganisationProfile): Promise<ApplicationDocument> {
    await wait(300);
    if (isMockScenario("generate-error")) {
      throw new Error(
        "Simulated failure (?mock=generate-error): the draft couldn't be generated. Nothing was sent anywhere.",
      );
    }
    return {
      id: `doc-${grant.id}-${Date.now()}`,
      grantId: grant.id,
      grantTitle: grant.title,
      sections: makeSections(grant, profile),
      updatedAt: new Date().toISOString(),
    };
  }

  async rewriteSection(
    sectionTitle: string,
    currentContent: string,
    profile: OrganisationProfile,
    grant: Grant | undefined,
    _documentId?: string,
  ): Promise<string> {
    await wait(700);
    if (isMockScenario("rewrite-error")) {
      throw new Error(
        "Simulated failure (?mock=rewrite-error): the mock rewrite didn't finish. Your text is unchanged.",
      );
    }
    const org = profile.organisationName || "Our organisation";
    const programme = grant ? grantContext(grant) : "the target programme";
    const openings: Record<string, string> = {
      "Organisation Overview": `${org} is a ${profile.organisationType || "European"} organisation with a clear mandate in the ${profile.sector || "target"} sector, operating from ${profile.country || "the EU"}.`,
      "Project Summary": `${profile.projectTitle || "This project"} addresses a well-defined need with a focused, ${profile.projectDuration || "multi-month"} plan aligned to ${programme}.`,
      "Problem Statement": `Current market and policy conditions in ${profile.country || "Europe"} create a measurable gap that this project directly targets.`,
      "Proposed Solution": `The proposed approach combines proven methods with novel elements to deliver outcomes aligned to ${programme} priorities.`,
      Innovation:
        "The innovation lies in the combination of domain expertise, methodology, and cross-sector partnership — going beyond incremental improvement.",
      Objectives: `Objectives are specific, measurable, and mapped to ${programme} KPIs, with clear ownership across the consortium.`,
      "Expected Impact":
        "Impact is expected across economic, societal, and environmental dimensions, with quantifiable indicators.",
      Sustainability:
        "Sustainability is embedded from day one, with a credible plan to continue results beyond the funded period.",
      "Implementation Plan":
        "Implementation follows a disciplined work-package structure with clear deliverables, milestones, and governance.",
      Timeline:
        "The timeline is realistic, front-loads risk reduction, and reserves adequate time for dissemination and uptake.",
      "Budget Overview": `The budget is proportionate, cost-effective, and fully aligned to ${programme} eligibility rules.`,
      "Risk Management":
        "Risks are identified early with named owners, mitigations, and periodic review checkpoints.",
    };
    const opener =
      openings[sectionTitle] ??
      `This section on ${sectionTitle.toLowerCase()} has been refined for clarity and evaluator focus.`;
    return `${opener}\n\n${currentContent.trim()}\n\nThis revision sharpens the narrative for ${programme} evaluators and highlights fit with ${org}'s strengths.`;
  }
}

function isLocalApplication(value: unknown): value is DemoApplication {
  if (typeof value !== "object" || value === null) return false;
  const application = value as Record<string, unknown>;
  return (
    typeof application.id === "string" &&
    typeof application.grantId === "string" &&
    typeof application.grantTitle === "string" &&
    typeof application.grantOrganisation === "string" &&
    typeof application.applicantOrganisation === "string" &&
    typeof application.status === "string" &&
    typeof application.fundingAmount === "string" &&
    typeof application.deadline === "string" &&
    typeof application.updatedAt === "string"
  );
}

function readLocalApplications(): DemoApplication[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_APPLICATIONS);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isLocalApplication)
      ? (parsed as DemoApplication[])
      : null;
  } catch {
    return null;
  }
}

function writeLocalApplications(applications: DemoApplication[]): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(KEY_APPLICATIONS, JSON.stringify(applications));
    return true;
  } catch {
    return false;
  }
}

function upsertLocalApplication(
  applications: DemoApplication[],
  application: DemoApplication,
): DemoApplication[] {
  const existing = applications.find((item) => item.grantId === application.grantId);
  if (!existing) return [application, ...applications];
  return applications.map((item) =>
    item.grantId === application.grantId
      ? { ...application, id: item.id, status: item.status }
      : item,
  );
}
