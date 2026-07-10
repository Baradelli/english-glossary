/**
 * Which words enter a quiz. The weekly quiz takes everything captured in the
 * last 7 days (same rule the legacy weekly exam used); the vocabulary quiz
 * draws a capped, weighted sample that favours words the learner struggles
 * with (low ease, never reviewed, overdue) over mastered ones. Pure: dates
 * and the rng are always injected.
 */

import { sampleWeighted, type Rng } from "./rng.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Words captured in the 7 days up to `now` — the weekly quiz window. */
export function selectWeeklyWords<T extends { readonly createdAt: Date }>(
  words: readonly T[],
  now: Date,
): T[] {
  const since = now.getTime() - WEEK_MS;
  return words.filter((word) => word.createdAt.getTime() >= since);
}

/** Maximum questions in a vocabulary quiz (~5–8 minutes of session). */
export const VOCAB_QUIZ_CAP = 20;

/** The SRS fields the vocabulary weighting reads. */
export interface SrsWeightInput {
  readonly easeFactor: number;
  readonly repetitions: number;
  readonly nextReview: Date;
}

/**
 * Sampling weight of a word for the vocabulary quiz. Struggling words weigh
 * more: low ease (ease already condenses past failures), never reviewed
 * (+1), currently due (+0.5). Floored at 0.25 so mastered words still have a
 * small chance of showing up.
 */
export function vocabularyWeight(word: SrsWeightInput, now: Date): number {
  const weight =
    (3.0 - Math.min(word.easeFactor, 3.0)) +
    (word.repetitions === 0 ? 1 : 0) +
    (word.nextReview.getTime() <= now.getTime() ? 0.5 : 0);
  return Math.max(weight, 0.25);
}

/**
 * Draws up to {@link VOCAB_QUIZ_CAP} words, without repetition, weighted by
 * {@link vocabularyWeight}. Deterministic for a given rng.
 */
export function selectVocabularyWords<T extends SrsWeightInput>(
  words: readonly T[],
  now: Date,
  rng: Rng,
): T[] {
  return sampleWeighted(
    words,
    (word) => vocabularyWeight(word, now),
    VOCAB_QUIZ_CAP,
    rng,
  );
}
