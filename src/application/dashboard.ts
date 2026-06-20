/**
 * Dashboard metrics (§ Fluxo D). Word state is derived (§6.1), never stored, so
 * counts always reflect the live SRS fields — a word that regressed from
 * "dominada" shows up under "aprendendo" automatically.
 */

import {
  deriveWordState,
  type ExamRepository,
  type ReviewLogRepository,
  type SourceRepository,
  type WordRepository,
} from "../domain/index.js";
import type { DashboardMetrics } from "./dto.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getDashboardMetrics(
  deps: {
    words: WordRepository;
    sources: SourceRepository;
    reviewLogs: ReviewLogRepository;
    exams: ExamRepository;
  },
  now: Date,
): Promise<DashboardMetrics> {
  const words = await deps.words.listAll();
  const byState = { nova: 0, aprendendo: 0, dominada: 0 };
  for (const word of words) {
    byState[deriveWordState(word)] += 1;
  }

  const sources = (await deps.sources.list()).length;
  const reviewsLast7Days = await deps.reviewLogs.countSince(
    new Date(now.getTime() - WEEK_MS),
  );

  const exams = await deps.exams.listAll();
  const corrected = exams.filter(
    (exam) => exam.status === "corrigida" && exam.score !== null,
  );
  const averageScore =
    corrected.length > 0
      ? Math.round(
          corrected.reduce((sum, exam) => sum + (exam.score ?? 0), 0) /
            corrected.length,
        )
      : null;

  return {
    words: { total: words.length, ...byState },
    sources,
    reviewsLast7Days,
    exams: { total: exams.length, corrected: corrected.length, averageScore },
  };
}
