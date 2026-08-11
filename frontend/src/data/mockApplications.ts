/**
 * DEMO DATA — hard-coded sample applications for the Pipeline Dashboard.
 *
 * None of these are real applications: nothing here is submitted anywhere, no
 * status is ever written back, and the pipeline view is display-only for now.
 * Replace this module with a `GET /applications` call once a backend exists
 * (see docs/api-contract.md).
 *
 * The pipeline is a GLOBAL view across conversations, so these records are
 * deliberately independent of the stored Conversation state and of the
 * conversation localStorage keys — nothing here reads or writes them.
 */

export type ApplicationStatus = "drafting" | "submitted" | "under_review" | "approved" | "rejected";

/**
 * An application as the pipeline needs to display it. The grant it was
 * started from is denormalised (title + funding organisation) rather than
 * looked up: a submitted application is a snapshot, so it keeps the grant
 * details it was created with even if the catalogue entry later changes.
 * `grantId` values matching entries in MOCK_GRANTS are intentional.
 */
export interface DemoApplication {
  id: string;
  grantId: string;
  /** Title of the grant/call this application was started from. */
  grantTitle: string;
  /** The funding body or programme behind the grant. */
  grantOrganisation: string;
  /** The organisation applying — the pipeline spans several demo orgs. */
  applicantOrganisation: string;
  status: ApplicationStatus;
  fundingAmount: string;
  /** Call deadline, ISO date. */
  deadline: string;
  /** Last edit / last status change, ISO timestamp. */
  updatedAt: string;
}

export const MOCK_APPLICATIONS: DemoApplication[] = [
  {
    id: "app-demo-1",
    grantId: "digital-europe",
    grantTitle: "Digital Transformation Accelerator for SMEs",
    grantOrganisation: "Digital Europe Programme",
    applicantOrganisation: "Northlight Robotics",
    status: "drafting",
    fundingAmount: "€500,000 – €2,000,000",
    deadline: "2026-09-20",
    updatedAt: "2026-08-04T09:20:00.000Z",
  },
  {
    id: "app-demo-2",
    grantId: "life-cet",
    grantTitle: "LIFE Clean Energy Transition",
    grantOrganisation: "LIFE Programme",
    applicantOrganisation: "Cascadia Energy Collective",
    status: "drafting",
    fundingAmount: "€700,000 – €1,500,000",
    deadline: "2027-02-15",
    updatedAt: "2026-07-29T16:05:00.000Z",
  },
  {
    id: "app-demo-3",
    grantId: "eic-accelerator",
    grantTitle: "EIC Accelerator — Breakthrough Innovation",
    grantOrganisation: "European Innovation Council",
    applicantOrganisation: "Northlight Robotics",
    status: "submitted",
    fundingAmount: "Up to €2.5M grant + up to €15M equity",
    deadline: "2026-11-30",
    updatedAt: "2026-07-22T11:45:00.000Z",
  },
  {
    id: "app-demo-4",
    grantId: "horizon-cluster-4",
    grantTitle: "Industrial Data Spaces for Manufacturing",
    grantOrganisation: "Horizon Europe — Cluster 4",
    applicantOrganisation: "Verda Materials",
    status: "under_review",
    fundingAmount: "€1,200,000 – €3,000,000",
    deadline: "2026-06-11",
    updatedAt: "2026-06-18T08:30:00.000Z",
  },
  {
    id: "app-demo-5",
    grantId: "interreg-central",
    grantTitle: "Interreg Central Europe — Green Innovation",
    grantOrganisation: "Interreg Central Europe",
    applicantOrganisation: "Cascadia Energy Collective",
    status: "approved",
    fundingAmount: "€850,000",
    deadline: "2026-03-05",
    updatedAt: "2026-05-30T14:10:00.000Z",
  },
  {
    id: "app-demo-6",
    grantId: "eurostars-3",
    grantTitle: "Eurostars-3 Joint Programme",
    grantOrganisation: "Eureka / EU Partnership",
    applicantOrganisation: "Northlight Robotics",
    status: "rejected",
    fundingAmount: "Up to €500,000",
    deadline: "2026-02-12",
    updatedAt: "2026-04-16T10:00:00.000Z",
  },
];
