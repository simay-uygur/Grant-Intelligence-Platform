import type { ApplicationStatus } from "@/data/mockApplications";

/**
 * How an application status is ordered, named, described and tinted.
 *
 * Extracted from PipelineDashboard so the draft editor can show the same
 * status with the same words and colours — mirrors grants/grantPresentation.ts.
 * Presentation only: no state, no storage, no React.
 */

// Pipeline order: how far an application has travelled, with the two terminal
// outcomes last. Drives both the rendering order and which groups exist.
export const STATUS_ORDER: readonly ApplicationStatus[] = [
  "drafting",
  "submitted",
  "under_review",
  "approved",
  "rejected",
];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  drafting: "Drafting",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};

/** Narrows the Select's plain-string value back to the status union. */
export function isStatus(value: string): value is ApplicationStatus {
  return value in STATUS_LABEL;
}

export const STATUS_DESCRIPTION: Record<ApplicationStatus, string> = {
  drafting: "Still being written — not yet sent to the funder.",
  submitted: "Sent to the funder, awaiting acknowledgement.",
  under_review: "With the funder's evaluators; a decision is pending.",
  approved: "Funded — the funder accepted the application.",
  rejected: "Not funded this round.",
};

/**
 * Per-column empty copy. Each stage gets its own line rather than one shared
 * "No applications" — an empty Rejected column is good news, an empty
 * Drafting column just means nothing has been started.
 */
export const STATUS_EMPTY: Record<ApplicationStatus, string> = {
  drafting: "Nothing in draft",
  submitted: "Nothing sent to a funder",
  under_review: "Nothing with reviewers",
  approved: "No approvals yet",
  rejected: "No rejections — so far",
};

/**
 * Semantic tints built from the design tokens (never raw palette literals),
 * so each status keeps its meaning and its contrast in both light and dark
 * mode: neutral = not out the door yet, brand = in flight, warning = waiting
 * on someone else, success = funded, destructive = declined. `--brand` has
 * a proper `.dark` override (see styles.css), so the same classes hold
 * contrast in both themes without a per-usage workaround.
 */
export const STATUS_BADGE: Record<ApplicationStatus, string> = {
  drafting: "border-border bg-muted text-muted-foreground",
  submitted: "border-brand/40 bg-brand/15 text-brand",
  under_review: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

/**
 * Once a funder has approved or rejected an application, its call deadline is
 * history — flagging it as "Closed" or "Closes in 5 days" would be noise at
 * best and alarming at worst. Urgency shows only while the outcome is still
 * open: drafting, submitted, under review.
 */
const TERMINAL_STATUSES: readonly ApplicationStatus[] = ["approved", "rejected"];

export function showsDeadlineUrgency(status: ApplicationStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

/** Left edge accent, so a card's status reads at a glance while scanning. */
export const STATUS_ACCENT: Record<ApplicationStatus, string> = {
  drafting: "border-l-border",
  submitted: "border-l-brand/60",
  under_review: "border-l-warning/60",
  approved: "border-l-success/60",
  rejected: "border-l-destructive/60",
};

/**
 * A barely-there background wash for a stage group's header — deliberately
 * separate from STATUS_BADGE (which is a solid-ish chip meant to stand out)
 * and STATUS_ACCENT (a border, immune to contrast concerns). This is a
 * background only, so it's safe to use even for `submitted`, where --brand
 * has no .dark override for TEXT — a 5% wash never has a text-contrast
 * problem, only a color sitting on top of it would.
 */
export const STATUS_GROUP_TINT: Record<ApplicationStatus, string> = {
  drafting: "bg-muted/50",
  submitted: "bg-brand/5",
  under_review: "bg-warning/5",
  approved: "bg-success/5",
  rejected: "bg-destructive/5",
};
