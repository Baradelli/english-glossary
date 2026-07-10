/**
 * Deterministic randomness for the local quiz engine. The seed is always
 * injected by the caller (never read from a clock here), so every quiz built
 * from the same seed is byte-for-byte reproducible — the property all the
 * quiz-domain tests lean on. No I/O, no Math.random.
 */

/** A pseudo-random generator: each call returns a float in [0, 1). */
export type Rng = () => number;

/**
 * mulberry32 — a tiny, well-distributed 32-bit PRNG. Same seed, same sequence.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle driven by the injected rng. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    // Indices are in range by construction; TS can't see that.
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}

/**
 * Weighted sampling WITHOUT replacement: picks up to `count` distinct items,
 * each draw proportional to `weightOf` among the items still available.
 * Non-positive weights are treated as 0; when every remaining weight is 0 the
 * draw falls back to uniform (so callers with a weight floor never hit it).
 */
export function sampleWeighted<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  count: number,
  rng: Rng,
): T[] {
  const remaining = [...items];
  const picked: T[] = [];
  while (picked.length < count && remaining.length > 0) {
    const weights = remaining.map((item) => Math.max(0, weightOf(item)));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let index: number;
    if (total <= 0) {
      index = Math.floor(rng() * remaining.length);
    } else {
      const target = rng() * total;
      let cumulative = 0;
      index = remaining.length - 1; // guard against float rounding
      for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i] as number;
        if (target < cumulative) {
          index = i;
          break;
        }
      }
    }
    const chosen = remaining.splice(index, 1)[0] as T;
    picked.push(chosen);
  }
  return picked;
}
