import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarClock, Coins, MessagesSquare, Rows3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ApplicationStatus, DemoApplication } from "@/data/mockApplications";
import { formatDeadline } from "@/utils/deadline";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
// The shared deadline badge, reused so grant results and pipeline cards can't
// drift into two different definitions of "closing soon".
import { DeadlineBadge } from "@/components/grants/DeadlineBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Pipeline order: how far an application has travelled, with the two terminal
// outcomes last. Drives both the rendering order and which groups exist.
const STATUS_ORDER: readonly ApplicationStatus[] = [
  "drafting",
  "submitted",
  "under_review",
  "approved",
  "rejected",
];

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  drafting: "Drafting",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};

/** Narrows the Select's plain-string value back to the status union. */
function isStatus(value: string): value is ApplicationStatus {
  return value in STATUS_LABEL;
}

const STATUS_DESCRIPTION: Record<ApplicationStatus, string> = {
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
const STATUS_EMPTY: Record<ApplicationStatus, string> = {
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
 * on someone else, success = funded, destructive = declined.
 *
 * `submitted` is the one exception to "same classes in both themes": --brand
 * has no .dark override (it stays a dark blue), so `text-brand` on a dark
 * card falls to roughly 1.9:1. The blue signal moves to the fill and border
 * there, and the label switches to --foreground, which does flip.
 */
const STATUS_BADGE: Record<ApplicationStatus, string> = {
  drafting: "border-border bg-muted text-muted-foreground",
  submitted: "border-brand/40 bg-brand/15 text-brand dark:text-foreground",
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

function showsDeadlineUrgency(status: ApplicationStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

/** Left edge accent, so a card's status reads at a glance while scanning. */
const STATUS_ACCENT: Record<ApplicationStatus, string> = {
  drafting: "border-l-border",
  submitted: "border-l-brand/60",
  under_review: "border-l-warning/60",
  approved: "border-l-success/60",
  rejected: "border-l-destructive/60",
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 self-start whitespace-nowrap font-medium", STATUS_BADGE[status])}
    >
      <span className="sr-only">Status: </span>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/**
 * Motion vocabulary for a status change, all of it `motion-safe:`-gated so
 * `prefers-reduced-motion: reduce` gets the state change and nothing else.
 * ~200ms: long enough for the eye to follow, short enough that it never feels
 * like waiting.
 */
const CARD_ENTER_CLASSES =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-top-1 motion-safe:duration-200 motion-safe:ease-out";

/**
 * The departing copy. `fill-mode-forwards` holds it invisible until React
 * drops it a moment later, so it can't flash back at the end of the keyframes.
 * `motion-reduce:hidden` means it never appears at all under reduced motion.
 */
const CARD_GHOST_CLASSES =
  "pointer-events-none motion-reduce:hidden motion-safe:animate-out motion-safe:fade-out-0 motion-safe:zoom-out-95 motion-safe:duration-200 motion-safe:ease-in motion-safe:fill-mode-forwards";

function ApplicationCard({
  application,
  onStatusChange,
  onOpenDetails,
  /** Rendering the card as it leaves its old column — visual only, never interactive. */
  ghost,
  /** Rendering the card as it arrives in its new column. */
  entering,
}: {
  application: DemoApplication;
  onStatusChange: (applicationId: string, status: ApplicationStatus) => void;
  onOpenDetails: () => void;
  ghost?: boolean;
  entering?: boolean;
}) {
  return (
    // `relative` anchors the title button's stretched hit area below.
    <Card
      className={cn(
        "relative flex h-full flex-col border-l-4 transition-shadow hover:shadow-md",
        STATUS_ACCENT[application.status],
        entering && CARD_ENTER_CLASSES,
        ghost && CARD_GHOST_CLASSES,
      )}
    >
      {/* Stacked rather than badge-beside-org: columns get narrow on tablet,
          and a side-by-side row would squeeze the funder name to an ellipsis. */}
      <CardHeader className="gap-2 p-3 pb-2">
        <StatusBadge status={application.status} />
        {/* break-words: columns get narrow, and neither of these may spill
            past the card edge if a single word outruns the line. */}
        <p className="break-words text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {application.grantOrganisation}
        </p>
        <h4 className="break-words text-sm font-semibold leading-snug text-card-foreground">
          {ghost ? (
            application.grantTitle
          ) : (
            /* The card can't be a <button> — it contains the status Select,
               and interactive controls may not nest. Instead the title is the
               button, and `after:absolute after:inset-0` stretches its hit
               area across the whole card: one tab stop, whole-card click,
               no nested interactives. The Select is raised above it below. */
            <button
              type="button"
              onClick={onOpenDetails}
              aria-label={`View ${application.grantTitle} application details`}
              className="rounded-sm text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {application.grantTitle}
            </button>
          )}
        </h4>
      </CardHeader>

      <CardContent className="mt-auto p-3 pt-0">
        <dl className="space-y-1.5 text-xs text-muted-foreground">
          {/* The applicant organisation lives in the details sheet now — the
              card face keeps only what's worth scanning across a column. */}
          <div className="flex items-center gap-2">
            <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Funding</dt>
            <dd className="truncate" title={application.fundingAmount}>
              {application.fundingAmount}
            </dd>
          </div>
          {/* flex-wrap so the urgency badge drops to its own line rather than
              squeezing the date when a column is at its narrowest. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Deadline</dt>
            <dd>{formatDeadline(application.deadline)}</dd>
            {showsDeadlineUrgency(application.status) && (
              <DeadlineBadge deadline={application.deadline} compact />
            )}
          </div>
        </dl>
        {/* z-10 lifts the status control above the title button's stretched
            overlay, and stopPropagation keeps a click on it from ever being
            read as "open the details sheet". */}
        <div
          className="relative z-10 mt-3 border-t border-border pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] text-muted-foreground">
            Updated {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
          </p>
          {ghost ? (
            // Stands in for the Select so the ghost keeps the card's exact
            // silhouette while it fades — a shorter ghost would read as a jump.
            <div className="mt-2 h-8 rounded-md border border-input" />
          ) : (
            <Select
              value={application.status}
              onValueChange={(value) => {
                // Radix hands back a plain string; only act on one of ours.
                if (isStatus(value)) onStatusChange(application.id, value);
              }}
            >
              <SelectTrigger
                aria-label={`Change status for ${application.grantTitle}`}
                className="mt-2 h-8 px-2 text-xs transition-colors hover:border-brand/50 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((status) => (
                  <SelectItem key={status} value={status} className="text-xs">
                    {STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

/**
 * The card's detail slide-over, built on the same Sheet primitive and layout
 * as GrantDetailsSheet (right side, full-width on mobile / sm:max-w-lg above,
 * bordered header, scrolling body, footer close) so the two read as one
 * pattern. Radix handles Escape, the focus trap, and returning focus to the
 * card title that opened it.
 *
 * Takes the application by reference rather than a snapshot, so a status
 * changed in here re-renders the sheet as well as the board.
 */
function ApplicationDetailsSheet({
  application,
  open,
  onOpenChange,
  onStatusChange,
}: {
  application: DemoApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (applicationId: string, status: ApplicationStatus) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        {!application ? (
          <>
            <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
              <SheetTitle>Application unavailable</SheetTitle>
              <SheetDescription>
                This application couldn&apos;t be found — it may have been removed.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 px-5 py-4" />
          </>
        ) : (
          <>
            <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
              <div className="text-[11px] font-medium uppercase tracking-wider text-brand">
                {application.grantOrganisation}
              </div>
              <SheetTitle className="text-base leading-snug">{application.grantTitle}</SheetTitle>
              <SheetDescription>
                Application summary. Status changes are saved locally in your browser.
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <dl className="space-y-4">
                <DetailField label="Status">
                  <div className="flex flex-col gap-2">
                    <StatusBadge status={application.status} />
                    <Select
                      value={application.status}
                      onValueChange={(value) => {
                        if (isStatus(value)) onStatusChange(application.id, value);
                      }}
                    >
                      <SelectTrigger
                        aria-label={`Change status for ${application.grantTitle}`}
                        className="h-9 transition-colors hover:border-brand/50 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {STATUS_DESCRIPTION[application.status]}
                    </p>
                  </div>
                </DetailField>

                <DetailField label="Applicant">{application.applicantOrganisation}</DetailField>
                <DetailField label="Funder / programme">
                  {application.grantOrganisation}
                </DetailField>
                <DetailField label="Funding">{application.fundingAmount}</DetailField>
                <DetailField label="Deadline">
                  <span className="flex flex-wrap items-center gap-2">
                    {formatDeadline(application.deadline)}
                    {showsDeadlineUrgency(application.status) && (
                      <DeadlineBadge deadline={application.deadline} />
                    )}
                  </span>
                </DetailField>
                <DetailField label="Last updated">
                  {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
                </DetailField>
              </dl>
            </div>

            <SheetFooter className="shrink-0 border-t border-border px-5 py-4">
              <SheetClose asChild>
                <Button type="button" variant="outline" className="rounded-lg hover:bg-muted">
                  Close
                </Button>
              </SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * One kanban column. It carries no width of its own: the board's grid track
 * divides the available space, and `min-w-0` lets the column shrink below its
 * content's natural width so a long grant title can never push the board
 * wider than the viewport.
 */
function StatusColumn({
  status,
  applications,
  onStatusChange,
  onOpenDetails,
  ghost,
  enteringId,
  isDestination,
}: {
  status: ApplicationStatus;
  applications: DemoApplication[];
  onStatusChange: (applicationId: string, status: ApplicationStatus) => void;
  onOpenDetails: (applicationId: string) => void;
  /** A card leaving this column, still drawn in the slot it just vacated. */
  ghost?: { application: DemoApplication; index: number };
  /** The card that just arrived in this column. */
  enteringId?: string;
  isDestination?: boolean;
}) {
  const headingId = `pipeline-group-${status}`;

  // The ghost sits back in its original slot rather than at the end, so the
  // card fades from where it actually was instead of jumping first.
  const items = useMemo(() => {
    const list = applications.map((application) => ({ application, isGhost: false }));
    if (ghost) {
      list.splice(Math.min(ghost.index, list.length), 0, {
        application: ghost.application,
        isGhost: true,
      });
    }
    return list;
  }, [applications, ghost]);

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-muted/40 p-3 transition-shadow",
        // Brief ring so the eye follows the card to where it landed. Ring is a
        // box-shadow, so it can't shift layout or widen the board.
        isDestination && "motion-safe:ring-2 motion-safe:ring-ring/60",
      )}
    >
      <div className="mb-3">
        <h3
          id={headingId}
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <span className="min-w-0 flex-1 truncate">{STATUS_LABEL[status]}</span>
          {/* Same tint as the cards' badges, so a column and its cards read as
              one status at a glance. */}
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              STATUS_BADGE[status],
            )}
            aria-label={`${applications.length} ${applications.length === 1 ? "application" : "applications"}`}
          >
            {applications.length}
          </span>
        </h3>
        {/* Clamped so every column header is the same height and the cards
            below them line up; the full text stays available on hover. */}
        <p
          className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground"
          title={STATUS_DESCRIPTION[status]}
        >
          {STATUS_DESCRIPTION[status]}
        </p>
      </div>

      {items.length === 0 ? (
        // Inline variant: the column's own heading and description already
        // explain the stage, so this stays to a single specific line.
        <EmptyState variant="inline" headingLevel="h4" title={STATUS_EMPTY[status]} />
      ) : (
        <ul role="list" className="flex flex-1 flex-col gap-3">
          {items.map(({ application, isGhost }) => (
            <li
              key={isGhost ? `ghost-${application.id}` : application.id}
              // The ghost is a duplicate of a card that has already moved:
              // hidden from assistive tech so it isn't announced or counted
              // twice, and it renders no focusable control of its own.
              aria-hidden={isGhost || undefined}
            >
              <ApplicationCard
                application={application}
                onStatusChange={onStatusChange}
                onOpenDetails={() => onOpenDetails(application.id)}
                ghost={isGhost}
                entering={!isGhost && application.id === enteringId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Global, read-only view of every application across all conversations.
 *
 * Deliberately NOT a ChatBlock: blocks belong to one conversation's message
 * history, whereas this spans all of them and isn't part of any transcript.
 * It renders as a separate main view instead (see App.tsx), which keeps the
 * app on its single route.
 *
 * Applications live in localStorage (see useApplications), seeded from the
 * demo data on first run. Changing a card's status re-groups it into the
 * target column and persists.
 */
/** Slightly longer than the 200ms keyframes, so the ghost is never cut short. */
const MOVE_ANIMATION_MS = 220;

interface CardMove {
  /** Snapshot taken before the change, so the ghost still shows the old status. */
  application: DemoApplication;
  fromStatus: ApplicationStatus;
  /** Where it sat in the old column, so the ghost fades from that exact slot. */
  fromIndex: number;
  toStatus: ApplicationStatus;
}

/**
 * Applications arrive as props, not from useApplications here: the chat also
 * writes to that store when an application is started, and two hook instances
 * over one key would race — each holding its own array and overwriting the
 * other's changes on the next write. App owns the single instance.
 */
export function PipelineDashboard({
  onGoToChat,
  applications,
  hydrated,
  persistenceOk,
  updateStatus,
}: {
  onGoToChat: () => void;
  applications: DemoApplication[];
  hydrated: boolean;
  persistenceOk: boolean;
  updateStatus: (applicationId: string, status: ApplicationStatus) => void;
}) {
  const [move, setMove] = useState<CardMove | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The id, not a snapshot, so a status changed inside the sheet re-renders
  // the sheet too. Deliberately not cleared on close: the sheet needs content
  // to render while it slides out (same reason GrantResults keeps its grant).
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const openDetails = useCallback((applicationId: string) => {
    setDetailsId(applicationId);
    setDetailsOpen(true);
  }, []);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Presentation only. `updateStatus` is called first and unchanged, so the
   * change is committed and persisted exactly as before — the animation is
   * never in the path of the write, and can't delay or drop it.
   */
  const handleStatusChange = useCallback(
    (applicationId: string, status: ApplicationStatus) => {
      const current = applications.find((a) => a.id === applicationId);
      updateStatus(applicationId, status);
      if (!current || current.status === status) return;

      const fromIndex = applications
        .filter((a) => a.status === current.status)
        .findIndex((a) => a.id === applicationId);

      setMove({
        application: current,
        fromStatus: current.status,
        fromIndex: Math.max(0, fromIndex),
        toStatus: status,
      });
      setAnnouncement(`${current.grantTitle} moved to ${STATUS_LABEL[status]}`);

      if (moveTimer.current) clearTimeout(moveTimer.current);
      moveTimer.current = setTimeout(() => setMove(null), MOVE_ANIMATION_MS);
    },
    [applications, updateStatus],
  );

  useEffect(() => {
    return () => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
    };
  }, []);

  // Grouped from live state, so a status change moves the card between
  // columns and both counts update on the next render.
  const grouped = useMemo(() => {
    const byStatus = new Map<ApplicationStatus, DemoApplication[]>(
      STATUS_ORDER.map((status) => [status, []]),
    );
    for (const application of applications) {
      byStatus.get(application.status)?.push(application);
    }
    return byStatus;
  }, [applications]);

  return (
    // Full main-content width: a kanban board wants the whole viewport, not
    // the chat's centred reading column (which lives in MessageList/Composer
    // and is deliberately left alone).
    <section aria-labelledby="pipeline-heading" className="w-full px-4 py-6 sm:px-6">
      {/* Polite, so a status change is read out after whatever the user is
          doing — never interrupting, never moving focus off the Select. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <header className="mb-6">
        <h2 id="pipeline-heading" className="text-lg font-semibold text-foreground">
          Application pipeline
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every application across all of your conversations, grouped by stage.
        </p>
        {/* Same spot and style as before; the wording now reflects that
            status changes are real but go no further than this browser. */}
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning">
          Demo data — status changes are saved locally in your browser.
        </p>
        {!persistenceOk && (
          <p
            role="status"
            aria-live="polite"
            className="mt-2 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive"
          >
            Status changes can&apos;t be saved right now — local storage may be full or unavailable
            (for example, in private browsing). They&apos;ll be lost when you reload.
          </p>
        )}
      </header>

      {/* Board: an equal-width grid track (grid-cols-N is repeat(N,
          minmax(0,1fr))), so the columns always divide the space available
          and can never overflow it — no horizontal scrolling at any width.
          Stacks to one column on phones, then steps up through 2/3 columns
          rather than jumping straight to five thin ones.

          Five-across starts at 1200px, not `xl`/1280, because the constraint
          is content width rather than viewport width: the sidebar takes
          288px, so a 1280px viewport leaves ~944px here — enough for five
          ~176px columns, but with nothing to spare if OS scaling or browser
          chrome shaves a few pixels off. The other two steps are written as
          min-[640px]/min-[1024px] (identical to sm/lg) on purpose: Tailwind
          emits arbitrary media variants as a group *before* the named
          breakpoints, so mixing the two would put `lg` after 1200px in the
          cascade and give three columns on a 1280px screen. Same-kind
          variants sort by width, so keeping all three arbitrary is what
          makes the widest rule win.

          Rows are auto-height, but grid items stretch to their row by
          default, and each column's card list is `flex-1` — so in any
          stacked or wrapped configuration a short group was padded out to
          match the tallest group in its row, leaving dead space after its
          last card. `items-start` sizes each column to its own content
          there. From 1200px all five sit in a single row, where stretching
          is what gives the columns their even bottom edge, so it comes
          back. */}
      {!hydrated ? (
        // Applications are read from storage in an effect, so the first
        // render has nothing yet. Showing the board here would flash five
        // empty columns, and showing the board-level empty state would
        // wrongly claim the pipeline is empty.
        <p className="text-sm text-muted-foreground">Loading applications…</p>
      ) : applications.length === 0 ? (
        <EmptyState
          headingLevel="h3"
          icon={Rows3}
          title="No applications in your pipeline yet"
          description="This board follows every application you start, from first draft through to the funder's decision. Find a grant you're eligible for in the chat, start an application, and it will appear here."
          action={{ label: "Find grants in chat", onClick: onGoToChat, icon: MessagesSquare }}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1200px]:grid-cols-5 min-[1200px]:items-stretch">
          {STATUS_ORDER.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              applications={grouped.get(status) ?? []}
              onStatusChange={handleStatusChange}
              onOpenDetails={openDetails}
              ghost={
                move?.fromStatus === status
                  ? { application: move.application, index: move.fromIndex }
                  : undefined
              }
              enteringId={move?.toStatus === status ? move.application.id : undefined}
              isDestination={move?.toStatus === status}
            />
          ))}
        </div>
      )}

      <ApplicationDetailsSheet
        application={applications.find((a) => a.id === detailsId) ?? null}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onStatusChange={handleStatusChange}
      />
    </section>
  );
}
