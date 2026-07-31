import type { OrganisationProfile } from "@/types";

export interface SampleProfile {
  id: string;
  label: string;
  profile: OrganisationProfile;
}

export const SAMPLE_PROFILES: SampleProfile[] = [
  {
    id: "visionworks-robotics",
    label: "VisionWorks Robotics",
    profile: {
      organisationName: "VisionWorks Robotics",
      organisationType: "SME",
      organisationDescription:
        "VisionWorks Robotics builds AI-assisted quality inspection systems for manufacturing teams.",
      country: "Germany",
      region: "Berlin",
      projectTitle: "AI Quality Inspection",
      projectDescription:
        "AI-driven visual quality inspection across three European factory pilots, reducing defects and improving production traceability.",
      fundingAmount: "€500,000 – €1,000,000",
      projectStartDate: "2026-10-01",
      projectDuration: "24 months",
      sector: "Digital & AI",
      eligibilityConstraints: "Open to consortium-based calls and SME innovation grants.",
    },
  },
  {
    id: "greentech-solutions",
    label: "GreenTech Solutions",
    profile: {
      organisationName: "GreenTech Solutions",
      organisationType: "SME",
      organisationDescription:
        "GreenTech Solutions develops practical technologies that help European manufacturers reduce energy use and waste.",
      country: "Germany",
      region: "Bavaria",
      projectTitle: "Circular Energy Innovation",
      projectDescription: "Energy-efficient circular manufacturing technology for European SMEs.",
      fundingAmount: "€500,000 – €1,000,000",
      projectStartDate: "2027-01-01",
      projectDuration: "24 months",
      sector: "Innovation",
      eligibilityConstraints: "SME-led project with European pilot partners.",
    },
  },
  {
    id: "university-energy-lab",
    label: "University Energy Lab",
    profile: {
      organisationName: "University Energy Lab",
      organisationType: "University",
      organisationDescription:
        "A university research group studying affordable, resilient energy systems with municipalities and industry partners.",
      country: "Netherlands",
      region: "Eindhoven",
      projectTitle: "Community Energy Storage",
      projectDescription:
        "Demonstration of interoperable renewable-energy storage for communities, campuses, and small industrial sites.",
      fundingAmount: "€1,000,000 – €2,500,000",
      projectStartDate: "2027-03-01",
      projectDuration: "36 months",
      sector: "Clean energy",
      eligibilityConstraints: "Research and public-sector partners are available for a consortium.",
    },
  },
  {
    id: "circular-manufacturing-lab",
    label: "Circular Manufacturing Lab",
    profile: {
      organisationName: "Circular Manufacturing Lab",
      organisationType: "Research institution",
      organisationDescription:
        "A research and industry partnership developing reusable materials and lower-waste production methods.",
      country: "France",
      region: "Lyon",
      projectTitle: "Low-Waste Industrial Materials",
      projectDescription:
        "Pilot new recyclable materials and data-driven processes that improve resource efficiency in European manufacturing.",
      fundingAmount: "€500,000 – €1,000,000",
      projectStartDate: "2027-06-01",
      projectDuration: "24 months",
      sector: "Manufacturing",
      eligibilityConstraints: "Open to collaborative research and industrial demonstration calls.",
    },
  },
];
