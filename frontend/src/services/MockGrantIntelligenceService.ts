import { MOCK_GRANTS } from "@/data/mockGrants";
import type {
  ApplicationDocument,
  DocumentSection,
  Grant,
  OrganisationProfile,
} from "@/types";
import type { GrantIntelligenceService } from "./GrantIntelligenceService";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeSections(
  grant: Grant,
  p: OrganisationProfile,
): DocumentSection[] {
  const org = p.organisationName || "Our organisation";
  const project = p.projectTitle || "the proposed project";
  return [
    {
      id: "organisation-overview",
      title: "Organisation Overview",
      content: `${org} is a ${p.organisationType || "European organisation"} based in ${p.region ? `${p.region}, ` : ""}${p.country || "the EU"}, active in the ${p.sector || "target"} sector. ${p.organisationDescription || ""}`.trim(),
    },
    {
      id: "project-summary",
      title: "Project Summary",
      content: `${project} seeks ${p.fundingAmount || "targeted funding"} under ${grant.programme} to deliver a ${p.projectDuration || "multi-month"} initiative starting ${p.projectStartDate || "in the next quarter"}. ${p.projectDescription || ""}`.trim(),
    },
    {
      id: "problem-statement",
      title: "Problem Statement",
      content: `The ${p.sector || "target"} sector in ${p.country || "Europe"} faces persistent barriers to adoption, scale, and cross-border collaboration. Without targeted intervention these gaps limit competitiveness and public value.`,
    },
    {
      id: "proposed-solution",
      title: "Proposed Solution",
      content: `${org} will deliver ${project} through a structured programme combining research, technology deployment, stakeholder engagement, and measurable outcomes aligned with the ${grant.programme} priorities.`,
    },
    {
      id: "innovation",
      title: "Innovation",
      content: `The project advances the state of the art by combining domain expertise in ${p.sector || "the target sector"} with modern methodologies, producing replicable outputs that go beyond current practice in ${p.country || "the region"}.`,
    },
    {
      id: "objectives",
      title: "Objectives",
      content: `1. Deliver measurable outcomes for beneficiaries in ${p.country || "the target country"}.\n2. Build durable partnerships across the value chain.\n3. Produce open, reusable outputs aligned with ${grant.programme} KPIs.\n4. Ensure long-term uptake and replication.`,
    },
    {
      id: "expected-impact",
      title: "Expected Impact",
      content: `${project} is expected to generate measurable economic, social, and environmental impact for ${org} and its ecosystem, contributing to the objectives of ${grant.programme} and to the European Green and Digital agendas.`,
    },
    {
      id: "sustainability",
      title: "Sustainability",
      content: `Beyond the funded period, ${org} will sustain the results through operational integration, follow-on funding, and partnerships that ensure continued impact for at least three years after project end.`,
    },
    {
      id: "implementation-plan",
      title: "Implementation Plan",
      content: `The work is organised into five interlinked work packages covering management, research, technology development, piloting, and dissemination. Each work package has clear deliverables, milestones, and responsible partners.`,
    },
    {
      id: "timeline",
      title: "Timeline",
      content: `Estimated project duration: ${p.projectDuration || "24 months"}, starting ${p.projectStartDate || "on award"}. Key milestones are scheduled at months 6, 12, 18, and at project close.`,
    },
    {
      id: "budget-overview",
      title: "Budget Overview",
      content: `Total requested budget: ${p.fundingAmount || "as per grant envelope"}. The budget is distributed across personnel, subcontracting, equipment, travel, and other direct costs in line with ${grant.programme} eligibility rules.`,
    },
    {
      id: "risk-management",
      title: "Risk Management",
      content: `Principal risks include technology adoption, partner availability, and regulatory change. Each is monitored with defined mitigation actions, owners, and review points throughout the project lifecycle.`,
    },
  ];
}

export class MockGrantIntelligenceService implements GrantIntelligenceService {
  async searchGrants(_profile: OrganisationProfile): Promise<Grant[]> {
    await wait(400);
    return MOCK_GRANTS;
  }

  async startApplication(
    grant: Grant,
    profile: OrganisationProfile,
  ): Promise<ApplicationDocument> {
    await wait(300);
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
  ): Promise<string> {
    await wait(700);
    const org = profile.organisationName || "Our organisation";
    const programme = grant?.programme ?? "the target programme";
    const openings: Record<string, string> = {
      "Organisation Overview": `${org} is a ${profile.organisationType || "European"} organisation with a clear mandate in the ${profile.sector || "target"} sector, operating from ${profile.country || "the EU"}.`,
      "Project Summary": `${profile.projectTitle || "This project"} addresses a well-defined need with a focused, ${profile.projectDuration || "multi-month"} plan aligned to ${programme}.`,
      "Problem Statement": `Current market and policy conditions in ${profile.country || "Europe"} create a measurable gap that this project directly targets.`,
      "Proposed Solution": `The proposed approach combines proven methods with novel elements to deliver outcomes aligned to ${programme} priorities.`,
      Innovation: `The innovation lies in the combination of domain expertise, methodology, and cross-sector partnership — going beyond incremental improvement.`,
      Objectives: `Objectives are specific, measurable, and mapped to ${programme} KPIs, with clear ownership across the consortium.`,
      "Expected Impact": `Impact is expected across economic, societal, and environmental dimensions, with quantifiable indicators.`,
      Sustainability: `Sustainability is embedded from day one, with a credible plan to continue results beyond the funded period.`,
      "Implementation Plan": `Implementation follows a disciplined work-package structure with clear deliverables, milestones, and governance.`,
      Timeline: `The timeline is realistic, front-loads risk reduction, and reserves adequate time for dissemination and uptake.`,
      "Budget Overview": `The budget is proportionate, cost-effective, and fully aligned to ${programme} eligibility rules.`,
      "Risk Management": `Risks are identified early with named owners, mitigations, and periodic review checkpoints.`,
    };
    const opener =
      openings[sectionTitle] ??
      `This section on ${sectionTitle.toLowerCase()} has been refined for clarity and evaluator focus.`;
    const trimmed = currentContent.trim();
    return `${opener}\n\n${trimmed}\n\nThis revision sharpens the narrative for ${programme} evaluators and highlights fit with ${org}'s strengths.`;
  }
}
