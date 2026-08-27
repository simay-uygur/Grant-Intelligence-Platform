import { format, formatDistance } from "date-fns";
import type { ApplicationDocument } from "@/types";

/** Human-readable provenance for a stored draft, using the viewer's local timezone. */
export function applicationWrittenLabel(
  document: Pick<ApplicationDocument, "createdAt" | "updatedAt">,
  now: Date = new Date(),
): string | null {
  const writtenAt = new Date(document.createdAt ?? document.updatedAt);
  if (Number.isNaN(writtenAt.getTime())) return null;

  const relative = formatDistance(writtenAt, now, { addSuffix: true });
  const exact = format(writtenAt, "MMM d, yyyy 'at' HH:mm");
  return `Application written ${relative} (${exact}).`;
}
