/**
 * Review-flow use cases (§ Fluxo B). The queue is every word due at or before
 * the injected date; reviewing a word runs SM-2 (which validates the 0..5
 * quality) and persists the new schedule plus its log atomically.
 */

import {
  reviewWord,
  type Word,
  type WordRepository,
} from "../domain/index.js";

export interface ReviewInput {
  readonly wordId: string;
  readonly quality: number;
}

export async function getReviewQueue(
  words: WordRepository,
  now: Date,
): Promise<Word[]> {
  return words.listDueForReview(now);
}

export async function reviewWordById(
  deps: { words: WordRepository },
  input: ReviewInput,
  now: Date,
): Promise<Word> {
  const word = await deps.words.findById(input.wordId);
  if (!word) throw new Error(`Palavra inexistente: ${input.wordId}`);

  const srs = reviewWord(word, input.quality, now);
  return deps.words.applyReview({
    wordId: word.id,
    srs: {
      easeFactor: srs.easeFactor,
      intervalDays: srs.intervalDays,
      repetitions: srs.repetitions,
      nextReview: srs.nextReview,
    },
    reviewLog: { quality: input.quality, reviewedAt: now },
  });
}
