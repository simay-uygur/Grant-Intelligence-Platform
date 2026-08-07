import { useCallback, useEffect, useRef, useState } from "react";
import {
  MOCK_APPLICATIONS,
  type ApplicationStatus,
  type DemoApplication,
} from "@/data/mockApplications";

/**
 * Dedicated, versioned key. Deliberately separate from the conversation keys
 * ("gi.conversations.v1" / "gi.activeConversationId.v1") and from the theme
 * key ("gi.theme.v1") — this hook never reads or writes any of them.
 */
const KEY_APPLICATIONS = "gi.applications.v1";

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

/** Reads the stored applications, or null when there's nothing usable to read. */
function loadApplications(): DemoApplication[] | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredApplications(window.localStorage.getItem(KEY_APPLICATIONS));
  } catch {
    return null;
  }
}

/** Returns whether the write actually succeeded, so callers can surface a status if needed. */
function saveApplications(applications: DemoApplication[]): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(KEY_APPLICATIONS, JSON.stringify(applications));
    return true;
  } catch {
    // Reachable in practice: storage disabled (some private-browsing modes),
    // or the quota is full. Nothing to invent here — just report it.
    return false;
  }
}

// TODO(api): entirely local (React state + localStorage), same as
// useConversations. Once a backend exists these would be GET /applications
// and PATCH /applications/{id} rather than a seeded local list — see
// docs/api-contract.md. The seed below is demo data, not a real pipeline.
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
    const existing = loadApplications();
    if (existing) {
      setApplications(existing);
    } else {
      // Nothing stored, or what was stored is unusable: fall back to the demo
      // seed and write it, so a fresh browser opens on a populated board.
      setApplications(MOCK_APPLICATIONS);
      setPersistenceOk(saveApplications(MOCK_APPLICATIONS));
    }
    setHydrated(true);
  }, []);

  // Every state change is persisted, so updateStatus can't forget to save.
  useEffect(() => {
    if (hydrated) setPersistenceOk(saveApplications(applications));
  }, [applications, hydrated]);

  const updateStatus = useCallback((applicationId: string, status: ApplicationStatus) => {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === applicationId && a.status !== status
          ? // updatedAt is documented as the last edit *or status change*, so
            // moving a card counts — and the card surfaces it as "Updated …".
            { ...a, status, updatedAt: new Date().toISOString() }
          : a,
      ),
    );
  }, []);

  return { applications, hydrated, persistenceOk, updateStatus };
}
