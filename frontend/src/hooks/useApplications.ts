import { useCallback, useEffect, useRef, useState } from "react";
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
 * fall back to the demo seed. Split out from the storage read so the rules —
 * missing, unparseable, not an array, empty, or wrong-shaped all mean "seed" —
 * can be tested without a browser. Pure.
 */
export function parseStoredApplications(raw: string | null): DemoApplication[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.every(isApplication) ? (parsed as DemoApplication[]) : null;
  } catch {
    return null;
  }
}

export function useApplications() {
  const [applications, setApplications] = useState<DemoApplication[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Reflects the most recent write attempt only — a later successful write
  // (once storage is available again) clears it automatically.
  const [persistenceOk, setPersistenceOk] = useState(true);
  const bootstrappedRef = useRef(false);

  // Idempotent bootstrap: run once, in-effect, guarded against StrictMode.
  // Reading in an effect rather than in a lazy initialiser also keeps the
  // first client render identical to the server's, so SSR can't mismatch.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
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

  return { applications, hydrated, persistenceOk, updateStatus };
}
