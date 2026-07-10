/**
 * Typo tolerance for typed/cloze answers. A single slip of the finger — one
 * substitution, insertion, deletion or adjacent transposition — should not
 * fail an answer the learner clearly knows, but short words ("cat", "the")
 * are too close to each other for that, so they demand an exact match.
 * Pure string logic: no I/O, no clock, no randomness.
 */

/**
 * Damerau–Levenshtein distance, OSA variant (adjacent transposition counts
 * as one edit, no substring is edited twice). Enough for the ≤1 check.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) (d[i] as number[])[0] = i;
  for (let j = 0; j <= n; j++) (d[0] as number[])[j] = j;

  for (let i = 1; i <= m; i++) {
    const row = d[i] as number[];
    const prev = d[i - 1] as number[];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        (prev[j] as number) + 1, // deletion
        (row[j - 1] as number) + 1, // insertion
        (prev[j - 1] as number) + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        const prev2 = d[i - 2] as number[];
        value = Math.min(value, (prev2[j - 2] as number) + 1); // transposition
      }
      row[j] = value;
    }
  }
  return (d[m] as number[])[n] as number;
}

/** Canonical answer form: trimmed, lowercased, inner whitespace collapsed. */
export function normalizeAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Whether `given` should be accepted as `expected`. Both sides are normalized
 * first; equal strings always pass. Expected words of 4+ characters tolerate
 * ONE edit (Damerau–Levenshtein ≤ 1); shorter ones require exact equality.
 */
export function isAnswerAcceptable(expected: string, given: string): boolean {
  const e = normalizeAnswer(expected);
  const g = normalizeAnswer(given);
  if (e === g) return true;
  if (e.length >= 4) return damerauLevenshtein(e, g) <= 1;
  return false;
}
