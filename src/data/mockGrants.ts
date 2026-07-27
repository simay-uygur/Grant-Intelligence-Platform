import type { Grant } from "@/types";

export const MOCK_GRANTS: Grant[] = [
  {
    id: "digital-europe",
    programme: "Digital Europe Programme",
    title: "Digital Transformation Accelerator for SMEs",
    matchPercentage: 94,
    fundingAmount: "€500,000 – €2,000,000",
    deadline: "2026-09-20",
    eligibleCountries: ["EU-27", "EEA", "Associated Countries"],
    organisationEligibility: ["SMEs", "Startups", "Consortia"],
    fundingType: "Grant (70% co-funding)",
    description:
      "Supports European SMEs deploying advanced digital technologies — AI, cybersecurity, cloud, and data — to modernise operations and scale across the single market.",
    whyItMatches:
      "Your organisation profile aligns strongly with the programme's focus on SME digital adoption and cross-border scaling within the EU.",
    matchReasons: [
      "Organisation type (SME) is a primary target of this call",
      "Sector and technology focus match the AI / cloud priority areas",
      "Requested funding range fits the €500K–€2M envelope",
      "Country of operation is fully eligible",
      "Project timeline aligns with the 18–36 month expected duration",
    ],
    requirements: [
      "Registered legal entity in an eligible country",
      "Minimum 2 years of trading history",
      "Detailed technical work plan and budget",
      "Impact and dissemination strategy",
    ],
    tags: ["AI", "SME", "Digital", "Scale-up"],
    sourceUrl: "https://digital-strategy.ec.europa.eu/en/activities/digital-programme",
  },
  {
    id: "eic-accelerator",
    programme: "European Innovation Council",
    title: "EIC Accelerator — Breakthrough Innovation",
    matchPercentage: 88,
    fundingAmount: "Up to €2.5M grant + up to €15M equity",
    deadline: "2026-11-30",
    eligibleCountries: ["EU-27", "Horizon Europe Associated Countries"],
    organisationEligibility: ["Startups", "Scale-ups", "Small mid-caps"],
    fundingType: "Blended finance (grant + equity)",
    description:
      "Supports high-risk, high-impact innovations by startups and small companies with the potential to create new markets or disrupt existing ones across Europe.",
    whyItMatches:
      "The project shows clear commercial ambition and a technology readiness profile compatible with EIC Accelerator's TRL 5–8 gateway.",
    matchReasons: [
      "Innovation profile matches deep-tech / breakthrough criteria",
      "Team size and structure fit early-stage scale-up thresholds",
      "Requested funding fits blended grant + equity envelope",
      "Strong EU-market scaling narrative in the project description",
    ],
    requirements: [
      "Short application followed by full proposal on invitation",
      "Video pitch and jury interview",
      "Business plan with financial projections",
      "Evidence of TRL 5+ prototype",
    ],
    tags: ["Deep-tech", "Scale-up", "Equity", "High-risk"],
    sourceUrl: "https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en",
  },
  {
    id: "life-cet",
    programme: "LIFE Programme",
    title: "LIFE Clean Energy Transition",
    matchPercentage: 81,
    fundingAmount: "€700,000 – €1,500,000",
    deadline: "2027-02-15",
    eligibleCountries: ["EU-27", "EEA/EFTA", "Candidate Countries"],
    organisationEligibility: ["SMEs", "NGOs", "Universities", "Public bodies", "Consortia"],
    fundingType: "Grant (up to 95% co-funding)",
    description:
      "Funds market-uptake actions that remove non-technological barriers to the clean-energy transition — capacity building, policy support, and scalable pilots.",
    whyItMatches:
      "Your project's sustainability angle and multi-stakeholder approach map well onto LIFE CET's market-uptake priorities.",
    matchReasons: [
      "Sector alignment with clean energy / sustainability",
      "Eligible for both single-entity and consortium submissions",
      "Duration fits the 24–36 month expected range",
      "Impact-oriented KPIs match programme priorities",
    ],
    requirements: [
      "Coordinator with financial capacity check",
      "Clear replication and market-uptake plan",
      "Stakeholder engagement strategy",
      "Compliance with EU Do-No-Significant-Harm principles",
    ],
    tags: ["Sustainability", "Energy", "Public-good", "Consortium"],
    sourceUrl: "https://cinea.ec.europa.eu/programmes/life_en",
  },
];
