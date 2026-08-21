import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Building2, CalendarClock, Coins, FileText, MessagesSquare, Rows3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@/types";
import type { ApplicationStatus, DemoApplication } from "@/data/mockApplications";
import { formatDeadline } from "@/utils/deadline";
import { resolveApplicationLink, type ApplicationLink } from "@/utils/applicationLink";
import {
  isStatus,
  showsDeadlineUrgency,
  STATUS_ACCENT,
  STATUS_BADGE,
  STATUS_DESCRIPTION,
  STATUS_EMPTY,
  STATUS_LABEL,
  STATUS_ORDER,
} from "@/components/pipeline/statusPresentation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { DeadlineBadge } from "@/components/grants/DeadlineBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge variant="outline" className={cn("w-fit font-medium", STATUS_BADGE[status])}>
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
  /** True for one beat right after this card's status became "approved". */
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
    // `relative` anchors the title button's stretched hit area below.
    <Card
      className={cn(
        "relative flex h-full flex-col border-l-4 transition-shadow hover:shadow-md",
        STATUS_ACCENT[application.status],
        entering && CARD_ENTER_CLASSES,
        ghost && CARD_GHOST_CLASSES,
      )}
    >
      {/* A separate layer for the celebration, rather than animating the card
          itself: the card already owns the enter/exit animation above, and a
          single element can't run two independent `animation` utilities at
          once — the second would silently overwrite the first. */}
      {celebrate && !ghost && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl motion-safe:animate-approved-glow"
        />
      )}
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
              className="rounded-sm text-left underline-offset-2 after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {application.grantTitle}
            </button>
          )}
        </h4>
      </CardHeader>

      <CardContent className="mt-auto p-3 pt-0">
        <dl className="space-y-1.5 text-xs text-muted-foreground">
          {/* Applicant, funding and "last updated" all live in the details
              sheet now. The face keeps only what's worth scanning down a
              column: who's funding it, what it is, when it closes. */}
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
        {application && (
          <>
            <SheetHeader className="shrink-0 border-b border-border p-5 text-left">
              <div className="flex items-center gap-2">
                <StatusBadge status={application.status} />
              </div>
              <SheetTitle className="text-base font-semibold leading-snug text-foreground">
                {application.grantTitle}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {application.grantOrganisation}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="space-y-5">
                <section aria-label="Status management">
                  <label
                    htmlFor="sheet-status-select"
                    className="block text-xs font-medium text-muted-foreground"
                  >
                    Application status
                  </label>
                  <Select
                    value={application.status}
                    onValueChange={(value) => {
                      if (isStatus(value)) onStatusChange(application.id, value);
                    }}
                  >
                    <SelectTrigger id="sheet-status-select" className="mt-1.5 w-full text-xs">
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
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {STATUS_DESCRIPTION[application.status]}
                  </p>
                </section>

                <section aria-label="Application details" className="border-t border-border pt-4">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <DetailField label="Applicant organisation">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{application.applicantOrganisation}</span>
                      </div>
                    </DetailField>
                    <DetailField label="Funding amount">
                      <div className="flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{application.fundingAmount}</span>
                      </div>
                    </DetailField>
                    <DetailField label="Call deadline">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{formatDeadline(application.deadline)}</span>
                        {showsDeadlineUrgency(application.status) && (
                          <DeadlineBadge deadline={application.deadline} compact />
                        )}
                      </div>
                    </DetailField>
                    <DetailField label="Last updated">
                      <span>
                        {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
                      </span>
                    </DetailField>
                  </dl>
                </section>

                <div
                  aria-label="Application actions"
                  className="flex flex-col gap-2 border-t border-border pt-4"
                >
                  {/* Actions are disabled rather than hidden when unavailable,
                      so the sheet has a consistent shape across applications —
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
 * One kanban column. It carries no width of its own: the board's grid track
 * divides the available space, and `min-w-0` lets the column shrink below its
 * content if squeezed.
 */
function StatusColumn({
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
  /** A card leaving this column, still drawn in the slot it just vacated. */
  ghost?: { application: DemoApplication; index: number };
  /** The card that just arrived in this column. */
  enteringId?: string;
  isDestination?: boolean;
  /** The card mid-celebration after just becoming Approved. */
  celebratingId?: string;
}) {
  const headingId = `pipeline-group-${status}`;

  // When a card leaves this column, the ghost sits at its old index so the rest
  // of the column doesn't jump instantly while the ghost fades out.
  const displayList = useMemo(() => {
    if (!ghost) return applications;
    const list = [...applications];
    const clampedIndex = Math.min(ghost.index, list.length);
    list.splice(clampedIndex, 0, ghost.application);
    return list;
  }, [applications, ghost]);

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-3 shadow-sm transition-colors",
        isDestination && "border-brand/40 bg-brand/[0.02]",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <h3 id={headingId} className="sr-only">
            {STATUS_LABEL[status]} applications
          </h3>
        </div>
        <span
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
          aria-label={`${applications.length} ${STATUS_LABEL[status]} applications`}
        >
          {applications.length}
        </span>
      </header>

      {displayList.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          {STATUS_EMPTY[status]}
        </div>
      ) : (
        /* Explicit role: Tailwind's preflight sets list-style:none, which
            drops list semantics in Safari/VoiceOver. */
        <ul role="list" className="mt-3 flex-1 space-y-2.5">
          {displayList.map((application) => {
            const isGhost = ghost?.application.id === application.id;
            return (
              <li key={isGhost ? `ghost-${application.id}` : application.id} className="h-full">
                <ApplicationCard
                  application={application}
                  onStatusChange={onStatusChange}
                  onOpenDetails={() => onOpenDetails(application.id)}
                  ghost={isGhost}
                  entering={!isGhost && application.id === enteringId}
                  celebrate={!isGhost && application.id === celebratingId}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Slightly longer than the 200ms keyframes, so the ghost is never cut short. */
const MOVE_ANIMATION_MS = 220;
/** Matches the approved-glow keyframes' own duration (see styles.css). */
const CELEBRATE_ANIMATION_MS = 900;

interface CardMove {
  /** Snapshot taken before the change, so the ghost still shows the old status. */
  application: DemoApplication;
  fromStatus: ApplicationStatus;
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
