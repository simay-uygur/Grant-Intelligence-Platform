export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Strips leading numbering (e.g. "1. ", "3. ", "1) ", "2 - ") from a title
 * so the rendering UI can number sections dynamically based on their current order.
 */
export function stripLeadingNumber(title: string): string {
  if (!title) return "";
  return title.replace(/^\s*\d+[.)\-:]\s*/, "").trim() || title;
}
