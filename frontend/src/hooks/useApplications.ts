import { useCallback, useEffect, useState } from "react";
import {
  MOCK_APPLICATIONS,
  type ApplicationStatus,
  type DemoApplication,
} from "@/data/mockApplications";
import { applicationService, isMockMode } from "@/services";

/**
 * Kept here rather than imported from the dashboard: the component's
 * STATUS_ORDER is a presentation concern (which column comes first), while
 * this is the validation set for what may come back out of storage.
 */
const STATUSES: readonly ApplicationStatus[] = [
  "drafting",
  "submitted",
  "under_review",
  "approved",
  "rejected",
];

/**
 * Guards against a stored value that parses but isn't shaped like an
 * application — a half-written key, or a record from an older build. Status
 * is checked against the union because an unrecognised one would belong to
 * no column and the card would silently vanish from the board.
 */
export function isApplication(value: unknown): value is DemoApplication {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.grantId === "string" &&
    typeof a.grantTitle === "string" &&
    typeof a.grantOrganisation === "string" &&
    typeof a.applicantOrganisation === "string" &&
    typeof a.fundingAmount === "string" &&
    typeof a.deadline === "string" &&
    typeof a.updatedAt === "string" &&
    typeof a.status === "string" &&
    (STATUSES as readonly string[]).includes(a.status)
  );
}

/**
 * Decides whether a raw stored string is usable, or whether the caller should
 * fall back to the demo seed. Split out from the storage read so the rules can
 * be tested without a browser. Pure.
 *
 * The presence of a valid array is the "already initialised" marker, so an
 * empty array means "respect the user's empty pipeline", not "seed again".
 */
export function parseStoredApplications(raw: string | null): DemoApplication[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.every(isApplication) ? (parsed as DemoApplication[]) : null;
  } catch {
    return null;
  }
}

/**
 * Adds an application, or refreshes the one already tracking the same grant.
 * Repeat starts keep the existing row id and status, so reopening a draft does
 * not duplicate it or move a submitted card back to drafting.
 */
export function applyUpsert(
  applications: DemoApplication[],
  application: DemoApplication,
): DemoApplication[] {
  const existing = applications.find((a) => a.grantId === application.grantId);
  if (!existing) return [application, ...applications];
  return applications.map((a) =>
    a.grantId === application.grantId ? { ...application, id: a.id, status: a.status } : a,
  );
}

export function useApplications() {
  const [applications, setApplications] = useState<DemoApplication[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Reflects the most recent write attempt only — a later successful write
  // (once storage is available again) clears it automatically.
  const [persistenceOk, setPersistenceOk] = useState(true);

  // Reading in an effect rather than in a lazy initialiser keeps the first
  // client render identical to the server's, so SSR can't mismatch. The
  // cleanup guard prevents stale async work from updating state after unmount,
  // while still allowing React StrictMode's remount pass to hydrate normally.
  useEffect(() => {
    let active = true;
    applicationService
      .listApplications()
      .then((loaded) => {
        if (!active) return;
        setApplications(loaded);
        setPersistenceOk(true);
      })
      .catch(() => {
        if (!active) return;
        setApplications(isMockMode ? MOCK_APPLICATIONS : []);
        setPersistenceOk(false);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateStatus = useCallback((applicationId: string, status: ApplicationStatus) => {
    let previous: DemoApplication[] = [];
    setApplications((prev) => {
      previous = prev;
      return prev.map((a) =>
        a.id === applicationId && a.status !== status
          ? // updatedAt is documented as the last edit *or status change*, so
            // moving a card counts — and the card surfaces it as "Updated …".
            { ...a, status, updatedAt: new Date().toISOString() }
          : a,
      );
    });
    void applicationService
      .updateApplicationStatus(applicationId, status)
      .then((updated) => {
        setApplications((current) =>
          current.map((application) => (application.id === applicationId ? updated : application)),
        );
        setPersistenceOk(true);
      })
      .catch(() => {
        setApplications(previous);
        setPersistenceOk(false);
      });
  }, []);

  const addApplication = useCallback((application: DemoApplication) => {
    setApplications((prev) => applyUpsert(prev, application));
    void applicationService
      .upsertApplicationSummary?.(application)
      .then(() => setPersistenceOk(true))
      .catch(() => setPersistenceOk(false));
  }, []);

  return { applications, hydrated, persistenceOk, updateStatus, addApplication };
}
