import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

function parseDeadline(value: string): Date | null {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function formatDeadline(value: string): string {
  const date = parseDeadline(value);
  return date ? format(date, "d MMM yyyy") : value;
}

const URGENT_WITHIN_DAYS = 21;

export type DeadlineUrgency = "expired" | "urgent" | null;

/** Only returns a status when the deadline string actually parses as a real date. */
export function deadlineUrgency(value: string): DeadlineUrgency {
  const date = parseDeadline(value);
  if (!date) return null;
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0) return "expired";
  if (days <= URGENT_WITHIN_DAYS) return "urgent";
  return null;
}
