/**
 * SM-2 spaced-repetition algorithm (ADR-004), as a pure, clock-free function.
 *
 * This is the de-facto "classic" SM-2: the ease factor is recomputed on every
 * review (including failures), and a failed answer (quality < 3) restarts the
 * schedule (repetitions -> 0, interval -> 1 day). The caller injects the
 * current date, so the function is fully deterministic and testable without a
 * real clock.
 */

export type WordState = "nova" | "aprendendo" | "dominada";

/** The SM-2 fields persisted on a Word (subset relevant to scheduling). */
export interface SrsState {
  /** Ease factor; SM-2 floors it at {@link MIN_EASE_FACTOR}. */
  readonly easeFactor: number;
  /** Current scheduling interval in days. */
  readonly intervalDays: number;
  /** Count of consecutive successful reviews. */
  readonly repetitions: number;
}

export interface SrsReviewResult extends SrsState {
  /** When the word becomes due again, derived from the injected date. */
  readonly nextReview: Date;
  /** Convenience: the §6.1 state implied by the new SRS fields. */
  readonly state: WordState;
}

/** SM-2's lower bound for the ease factor. */
export const MIN_EASE_FACTOR = 1.3;

/** The interval (days) at which a word is considered "dominada" (§6.1). */
export const MASTERED_INTERVAL_DAYS = 21;

/** Fresh SRS state for a newly created word. */
export const INITIAL_SRS_STATE: SrsState = {
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
};

/** Derives the word's display state from its SRS fields (§6.1). */
export function deriveWordState(
  srs: Pick<SrsState, "repetitions" | "intervalDays">,
): WordState {
  if (srs.repetitions === 0) return "nova";
  if (srs.intervalDays >= MASTERED_INTERVAL_DAYS) return "dominada";
  return "aprendendo";
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nextEaseFactor(easeFactor: number, quality: number): number {
  const updated =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(MIN_EASE_FACTOR, updated);
}

/**
 * Applies one SM-2 review to `state` and returns the new scheduling state.
 *
 * @param state   current SRS fields
 * @param quality recall quality, integer 0..5 (SM-2 scale)
 * @param now     injected "current date" — `nextReview` is computed from it
 */
export function reviewWord(
  state: SrsState,
  quality: number,
  now: Date,
): SrsReviewResult {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError(
      `quality must be an integer in 0..5, received: ${quality}`,
    );
  }

  const easeFactor = nextEaseFactor(state.easeFactor, quality);

  let repetitions: number;
  let intervalDays: number;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = state.repetitions + 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(state.intervalDays * easeFactor);
    }
  }

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReview: addDays(now, intervalDays),
    state: deriveWordState({ repetitions, intervalDays }),
  };
}
