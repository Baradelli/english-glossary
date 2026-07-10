/**
 * Exam-derived insights for the dashboard: the score trend across concluded
 * exams and the ranking of the words the learner misses the most. Pure — the
 * caller feeds already-loaded rows and injects the timezone offset.
 */

import type { Exam, ExamType, ExamWord, ReviewLog } from "../model.js";
import { localDayKey, type DayKey } from "./localDay.js";

export interface ScorePoint {
  /** Local day the exam was created on (trend x-axis tooltip). */
  readonly key: DayKey;
  readonly score: number;
  readonly examId: string;
  readonly type: ExamType;
}

/** The exam fields the trend reads — pass full {@link Exam}s or a projection. */
export type ScoreTrendExam = Pick<
  Exam,
  "id" | "type" | "status" | "score" | "createdAt"
>;

/**
 * Score trend over concluded exams, ascending by creation date. Only exams
 * that actually produced a grade enter: legacy/comprehension ones once
 * `corrigida`, local quizzes once `finalizada` — and in both cases only with
 * a non-null score (an AI correction may legitimately fail to grade).
 */
export function buildScoreTrend(
  exams: readonly ScoreTrendExam[],
  tzOffsetMinutes: number,
): ScorePoint[] {
  return [...exams]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .flatMap((exam) => {
      const concluded =
        exam.status === "corrigida" || exam.status === "finalizada";
      if (!concluded || exam.score === null) return [];
      return [
        {
          key: localDayKey(exam.createdAt, tzOffsetMinutes),
          score: exam.score,
          examId: exam.id,
          type: exam.type,
        },
      ];
    });
}

export interface DifficultWordStats {
  readonly wordId: string;
  /** All-time exam misses — contextual display fact, NOT added to the total. */
  readonly examErrors: number;
  /** Reviews with quality < 3 (already includes exam misses — see below). */
  readonly failedReviews: number;
  /** Equal to `failedReviews`; the single deduplicated miss count. */
  readonly totalMisses: number;
}

/** A review counts as a failure below this SM-2 quality (same rule as sm2.ts). */
const FAILING_QUALITY = 3;

/** How many words the dashboard ranking shows by default. */
const DIFFICULT_WORDS_LIMIT = 5;

/**
 * Ranks the words the learner misses the most.
 *
 * NO DOUBLE COUNTING: an exam miss is recorded TWICE in the database — as
 * `ExamWord.correct = false` AND as a `ReviewLog` with quality 2 (the quiz
 * flow feeds SM-2 on finish). Summing both would count the same miss twice,
 * so the ranking orders by `failedReviews` alone (logs with quality < 3,
 * which already cover both exam and review failures); `examErrors` is kept
 * only as a display fact ("· 2 erros em prova") and as the tie-breaker.
 * Order: failedReviews desc, examErrors desc, wordId asc (deterministic).
 * Words with neither kind of miss are excluded.
 */
export function rankDifficultWords(
  examResults: readonly Pick<ExamWord, "wordId" | "correct">[],
  reviewLogs: readonly Pick<ReviewLog, "wordId" | "quality">[],
  limit: number = DIFFICULT_WORDS_LIMIT,
): DifficultWordStats[] {
  const examErrorsByWord = new Map<string, number>();
  for (const result of examResults) {
    if (result.correct) continue;
    examErrorsByWord.set(
      result.wordId,
      (examErrorsByWord.get(result.wordId) ?? 0) + 1,
    );
  }

  const failedReviewsByWord = new Map<string, number>();
  for (const log of reviewLogs) {
    if (log.quality >= FAILING_QUALITY) continue;
    failedReviewsByWord.set(
      log.wordId,
      (failedReviewsByWord.get(log.wordId) ?? 0) + 1,
    );
  }

  const wordIds = new Set([
    ...examErrorsByWord.keys(),
    ...failedReviewsByWord.keys(),
  ]);

  return [...wordIds]
    .map((wordId) => {
      const failedReviews = failedReviewsByWord.get(wordId) ?? 0;
      return {
        wordId,
        examErrors: examErrorsByWord.get(wordId) ?? 0,
        failedReviews,
        totalMisses: failedReviews,
      };
    })
    .filter((stats) => stats.failedReviews > 0 || stats.examErrors > 0)
    .sort(
      (a, b) =>
        b.failedReviews - a.failedReviews ||
        b.examErrors - a.examErrors ||
        (a.wordId < b.wordId ? -1 : 1),
    )
    .slice(0, limit);
}
