import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarClock, Coins, FileText, MessagesSquare, Rows3, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@/types";
import type { ApplicationStatus, DemoApplication } from "@/data/mockApplications";
import { formatDeadline } from "@/utils/deadline";
import { type ApplicationLink, resolveApplicationLink } from "@/utils/applicationLink";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import {
  STATUS_ACCENT,
  STATUS_BADGE,
  STATUS_DESCRIPTION,
  STATUS_EMPTY,
  STATUS_GROUP_TINT,
  STATUS_LABEL,
  STATUS_ORDER,
  isStatus,
  showsDeadlineUrgency,
} from "@/components/pipeline/statusPresentation";

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 self-start whitespace-nowrap font-medium transition-colors duration-200",
        STATUS_BADGE[status],
      )}
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

/**
 * One application, as a horizontal row rather than a card — the row IS the
 * click target (same stretched-button/stopPropagation technique the old
 * card used, just applied to `relative` on the row instead of a Card), so
 * `relative` lives on the outer element and the title button's
 * `after:absolute after:inset-0` covers the whole row.
 *
 * No per-row status accent or badge: the row lives inside a StatusGroup
 * that already carries the colour and names the stage once in its header,
 * and the Select's own value already shows the specific status — repeating
 * both on every row would be the "loud" version the brief explicitly
 * doesn't want.
 */
function ApplicationRow({
  application,
  onStatusChange,
  onOpenDetails,
  /** Rendering the row as it leaves its old group — visual only, never interactive. */
  ghost,
  /** Rendering the row as it arrives in its new group. */
  entering,
  /** True for one beat right after this row's status became "approved". */
  celebrate,
}: {
  application: DemoApplication;
  onStatusChange: (applicationId: string, status: ApplicationStatus) => void;
  onOpenDetails: () => void;
  ghost?: boolean;
  entering?: boolean;
  celebrate?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-3 py-3 transition-colors hover:bg-muted/40",
        entering && CARD_ENTER_CLASSES,
        ghost && CARD_GHOST_CLASSES,
      )}
    >
      {/* Same reasoning as before: a separate layer rather than animating the
          row itself, since the row already owns the enter/exit animation
          above and a single element can't run two independent `animation`
          utilities at once. */}
      {celebrate && !ghost && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg motion-safe:animate-approved-glow"
        />
      )}

      {/* Call / funder — flex-1 with a floor rather than a fixed share, so a
          long title gets the whole line's width on any normal-width screen
          and only wraps the meta cluster below it once space genuinely runs
          out, instead of being squeezed into a kanban column's ~176px. */}
      <div className="min-w-[14rem] flex-1">
        <p className="break-words text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {application.grantOrganisation}
        </p>
        <h4 className="break-words text-sm font-semibold leading-snug text-foreground">
          {ghost ? (
            application.grantTitle
          ) : (
            <button
              type="button"
              onClick={onOpenDetails}
              aria-label={`View ${application.grantTitle} application details`}
              className="rounded-sm text-left underline-offset-2 after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {application.grantTitle}
            </button>
          )}
        </h4>
      </div>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Applicant</dt>
          <dd className="whitespace-nowrap">{application.applicantOrganisation}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Funding requested</dt>
          <dd className="whitespace-nowrap">{application.fundingAmount}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Deadline</dt>
          <dd className="whitespace-nowrap">{formatDeadline(application.deadline)}</dd>
          {showsDeadlineUrgency(application.status) && (
            <DeadlineBadge deadline={application.deadline} compact />
          )}
        </div>
      </dl>

      {/* z-10 lifts the status control above the title button's stretched
          overlay, and stopPropagation keeps a click on it from ever being
          read as "open the details sheet". */}
      <div className="relative z-10 w-40 shrink-0" onClick={(e) => e.stopPropagation()}>
        {ghost ? (
          // Stands in for the Select so the ghost keeps the row's exact
          // silhouette while it fades — a shorter ghost would read as a jump.
          <div className="h-8 rounded-md border border-input" />
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
              className="h-8 px-2 text-xs transition-colors hover:border-brand/50 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
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
    </div>
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
  link,
  onOpenConversation,
}: {
  application: DemoApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (applicationId: string, status: ApplicationStatus) => void;
  link: ApplicationLink;
  onOpenConversation: (conversationId: string) => void;
}) {
  const reasonId = "application-actions-reason";

  // Close before navigating: the pipeline unmounts on the view switch, and
  // leaving an open sheet behind would strand focus on a gone trigger.
  const goToConversation = () => {
    if (!link.conversationId) return;
    onOpenChange(false);
    onOpenConversation(link.conversationId);
  };

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

              <div className="mt-5 border-t border-border pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Go to
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {/* Both actions stay visible but disabled when there's
                      nothing to open, with the reason spelled out below —
                      a hidden button just leaves the user wondering. */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToConversation}
                    disabled={!link.hasLiveDraft}
                    aria-describedby={link.hasLiveDraft ? undefined : reasonId}
                    className="justify-start rounded-lg hover:bg-muted"
                  >
                    <FileText className="h-4 w-4" />
                    Open application draft
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToConversation}
                    disabled={!link.conversationId}
                    aria-describedby={link.conversationId ? undefined : reasonId}
                    className="justify-start rounded-lg hover:bg-muted"
                  >
                    <MessagesSquare className="h-4 w-4" />
                    Open source conversation
                  </Button>
                  {link.reason && (
                    <p id={reasonId} className="text-[11px] text-muted-foreground">
                      {link.reason}
                    </p>
                  )}
                </div>
              </div>
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
 * One stage group — full width, stacked vertically with its siblings rather
 * than sitting side by side as a kanban column. The colour language is two
 * deliberately restrained touches, not three: a `border-l-4` (STATUS_ACCENT)
 * along the whole group, and a soft wash (STATUS_GROUP_TINT) on the header
 * only — the row list below sits on the plain surface. Both are paired with
 * the stage name in text, never color alone.
 */
function StatusGroup({
  status,
  applications,
  onStatusChange,
  onOpenDetails,
  ghost,
  enteringId,
  isDestination,
  celebratingId,
}: {
  status: ApplicationStatus;
  applications: DemoApplication[];
  onStatusChange: (applicationId: string, status: ApplicationStatus) => void;
  onOpenDetails: (applicationId: string) => void;
  /** A row leaving this group, still drawn in the slot it just vacated. */
  ghost?: { application: DemoApplication; index: number };
  /** The row that just arrived in this group. */
  enteringId?: string;
  isDestination?: boolean;
  /** The row mid-celebration after just becoming Approved. */
  celebratingId?: string;
}) {
  const headingId = `pipeline-group-${status}`;

  // The ghost sits back in its original slot rather than at the end, so the
  // row fades from where it actually was instead of jumping first.
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
        "overflow-hidden rounded-xl border border-border border-l-4 bg-card transition-shadow",
        STATUS_ACCENT[status],
        // Brief ring so the eye follows the row to where it landed. Ring is a
        // box-shadow, so it can't shift layout.
        isDestination && "motion-safe:ring-2 motion-safe:ring-ring/60",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3",
          STATUS_GROUP_TINT[status],
        )}
      >
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span id={headingId}>{STATUS_LABEL[status]}</span>
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
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {STATUS_DESCRIPTION[status]}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        // Inline variant: the group's own heading and description already
        // explain the stage, so this stays to a single specific line.
        <EmptyState
          variant="inline"
          headingLevel="h4"
          title={STATUS_EMPTY[status]}
          className="mx-4 my-3 rounded-none border-0 border-t border-dashed border-border py-4"
        />
      ) : (
        <ul role="list" className="divide-y divide-border px-2 py-1">
          {items.map(({ application, isGhost }) => (
            <li
              key={isGhost ? `ghost-${application.id}` : application.id}
              // The ghost is a duplicate of a row that has already moved:
              // hidden from assistive tech so it isn't announced or counted
              // twice, and it renders no focusable control of its own.
              aria-hidden={isGhost || undefined}
            >
              <ApplicationRow
                application={application}
                onStatusChange={onStatusChange}
                onOpenDetails={() => onOpenDetails(application.id)}
                ghost={isGhost}
                entering={!isGhost && application.id === enteringId}
                celebrate={!isGhost && application.id === celebratingId}
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
/** Matches the approved-glow keyframes' own duration (see styles.css). */
const CELEBRATE_ANIMATION_MS = 900;

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
  conversations,
  onOpenConversation,
}: {
  onGoToChat: () => void;
  applications: DemoApplication[];
  hydrated: boolean;
  persistenceOk: boolean;
  updateStatus: (applicationId: string, status: ApplicationStatus) => void;
  /** Read-only: used solely to work out what a card can link back to. */
  conversations: Conversation[];
  onOpenConversation: (conversationId: string) => void;
}) {
  const [move, setMove] = useState<CardMove | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Set only inside handleStatusChange, at the moment a card's status becomes
  // "approved" — never re-derived from `applications`, so a re-render or a
  // remount (e.g. leaving and returning to this view) can never re-trigger it.
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The id, not a snapshot, so a status changed inside the sheet re-renders
  // the sheet too. Deliberately not cleared on close: the sheet needs content
  // to render while it slides out (same reason GrantResults keeps its grant).
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const openDetails = useCallback((applicationId: string) => {
    setDetailsId(applicationId);
    setDetailsOpen(true);
  }, []);

  const detailsApplication = applications.find((a) => a.id === detailsId) ?? null;
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

      // The quiet "nice." — fires only on the transition into Approved, not
      // when a card that's already Approved happens to re-render.
      if (status === "approved" && current.status !== "approved") {
        setCelebratingId(applicationId);
        if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
        celebrateTimer.current = setTimeout(() => setCelebratingId(null), CELEBRATE_ANIMATION_MS);
      }
    },
    [applications, updateStatus],
  );

  useEffect(() => {
    return () => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
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

      {/* Groups stack full-width rather than sitting side by side, so a row's
          title column always gets (nearly) the whole content width to work
          with — the thing that made long grant names cramped in the old
          five-equal-columns layout. Each row is its own `flex flex-wrap`,
          so within a group, narrow viewports wrap the meta fields (and, if
          truly tight, the Select) onto their own line rather than ever
          scrolling horizontally — no breakpoint tuning needed for that, it
          falls out of flex-wrap + the title's floor width. */}
      {!hydrated ? (
        // Applications are read from storage in an effect, so the first
        // render has nothing yet. Showing the board here would flash five
        // empty groups, and showing the board-level empty state would
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
        <div className="flex flex-col gap-4">
          {STATUS_ORDER.map((status) => (
            <StatusGroup
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
              celebratingId={status === "approved" ? (celebratingId ?? undefined) : undefined}
            />
          ))}
        </div>
      )}

      <ApplicationDetailsSheet
        application={detailsApplication}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onStatusChange={handleStatusChange}
        link={
          detailsApplication
            ? resolveApplicationLink(detailsApplication, conversations)
            : { conversationId: null, hasLiveDraft: false, reason: null }
        }
        onOpenConversation={onOpenConversation}
      />
    </section>
  );
}
