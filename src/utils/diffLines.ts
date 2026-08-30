export interface DiffLine {
  type: "same" | "removed" | "added";
  text: string;
}

/**
 * A lightweight line-level diff (Longest Common Subsequence over lines, not
 * a full Myers/word-level diff — this is meant to show a proposed section
 * rewrite at a glance, not to power a merge tool). O(n*m) time and space,
 * which is irrelevant here: a section is a handful of paragraphs, never
 * more than a few dozen lines.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const n = oldLines.length;
  const m = newLines.length;

  // dp[i][j] = length of the LCS of oldLines[i..] and newLines[j..].
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "same", text: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", text: oldLines[i] });
      i++;
    } else {
      result.push({ type: "added", text: newLines[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: "removed", text: oldLines[i] });
    i++;
  }
  while (j < m) {
    result.push({ type: "added", text: newLines[j] });
    j++;
  }
  return result;
}
