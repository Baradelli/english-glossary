/**
 * Dashboard use case (§ Fluxo D). Loads everything the "Painel" home needs in
 * one Promise.all and delegates the number-crunching to the pure insight
 * functions in `src/domain/insights/` — no clock in here: the page injects
 * `now` and the timezone offset (captured with `getTimezoneOffset()`).
 *
 * Word state is derived (§6.1), never stored, so the composition always
 * reflects the live SRS fields — a word that regressed from "dominada" shows
 * up under "aprendendo" automatically.
 */

import {
  HEATMAP_WEEKS,
  buildActivityCalendar,
  buildReviewForecast,
  buildScoreTrend,
  buildVocabGrowth,
  deriveWordState,
  localDayKey,
  localDayStartUtc,
  rankDifficultWords,
  shiftDayKey,
  type ExamRepository,
  type ReviewLogRepository,
  type SourceRepository,
  type WordRepository,
  type WordSightingRepository,
} from "../domain/index.js";
import type {
  DashboardData,
  DashboardMetrics,
  DifficultWordView,
} from "./dto.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface DashboardDeps {
  readonly words: WordRepository;
  readonly sources: SourceRepository;
  readonly reviewLogs: ReviewLogRepository;
  readonly sightings: WordSightingRepository;
  readonly exams: ExamRepository;
}

export async function getDashboardData(
  deps: DashboardDeps,
  now: Date,
  tzOffsetMinutes: number,
): Promise<DashboardData> {
  const today = localDayKey(now, tzOffsetMinutes);
  // Activity window: from the local-midnight start of the heatmap's oldest
  // possible day (today minus 18 weeks less one day) — logs and sightings are
  // the only unbounded tables, so the window caps the FULL rows we load. The
  // calendar itself gets unwindowed date-only lists: the streak may be longer
  // than the window and must never be capped by it.
  const cutoff = localDayStartUtc(
    shiftDayKey(today, -(HEATMAP_WEEKS * 7 - 1)),
    tzOffsetMinutes,
  );

  const [
    words,
    sources,
    reviewLogs,
    sightings,
    exams,
    examResults,
    reviewDates,
    captureDates,
  ] = await Promise.all([
    deps.words.listAll(),
    deps.sources.list(),
    deps.reviewLogs.listSince(cutoff),
    deps.sightings.listSince(cutoff),
    deps.exams.listAll(),
    deps.exams.listWordResults(),
    deps.reviewLogs.listReviewDates(),
    deps.sightings.listSeenDates(),
  ]);

  const activity = buildActivityCalendar({
    reviewDates,
    captureDates,
    now,
    tzOffsetMinutes,
  });
  const forecast = buildReviewForecast(
    words.map((word) => word.nextReview),
    now,
    tzOffsetMinutes,
  );
  const growth = buildVocabGrowth(
    words.map((word) => word.createdAt),
    now,
    tzOffsetMinutes,
  );
  const scoreTrend = buildScoreTrend(exams, tzOffsetMinutes);

  const composition = { nova: 0, aprendendo: 0, dominada: 0 };
  for (const word of words) {
    composition[deriveWordState(word)] += 1;
  }

  // Resolve the ranking's terms via one Map over listAll; an orphan wordId
  // (word deleted after the miss) is silently dropped from the list.
  const wordsById = new Map(words.map((word) => [word.id, word]));
  const difficultWords: DifficultWordView[] = rankDifficultWords(
    examResults,
    reviewLogs,
  ).flatMap((stats) => {
    const word = wordsById.get(stats.wordId);
    if (!word) return [];
    return [
      {
        wordId: stats.wordId,
        term: word.term,
        kind: word.kind,
        examErrors: stats.examErrors,
        failedReviews: stats.failedReviews,
      },
    ];
  });

  // Today's counts come from the same windowed rows the heatmap consumed —
  // the current local day is always inside the window.
  const reviewedTodayCount = reviewLogs.filter(
    (log) => localDayKey(log.reviewedAt, tzOffsetMinutes) === today,
  ).length;
  const capturedTodayCount = sightings.filter(
    (sighting) => localDayKey(sighting.seenAt, tzOffsetMinutes) === today,
  ).length;

  // Scalar totals (the old getDashboardMetrics shape). "Corrected" now means
  // CONCLUDED: legacy `corrigida` or quiz `finalizada`, with a real score —
  // and the average runs over that same set.
  const weekCutoff = now.getTime() - WEEK_MS;
  const concluded = exams.filter(
    (exam) =>
      (exam.status === "corrigida" || exam.status === "finalizada") &&
      exam.score !== null,
  );
  const totals: DashboardMetrics = {
    words: { total: words.length, ...composition },
    sources: sources.length,
    reviewsLast7Days: reviewLogs.filter(
      (log) => log.reviewedAt.getTime() >= weekCutoff,
    ).length,
    exams: {
      total: exams.length,
      corrected: concluded.length,
      averageScore:
        concluded.length > 0
          ? Math.round(
              concluded.reduce((sum, exam) => sum + (exam.score ?? 0), 0) /
                concluded.length,
            )
          : null,
    },
  };

  return {
    today: {
      streakDays: activity.streakDays,
      dueNowCount: forecast.dueNowCount,
      dueLaterTodayCount: forecast.dueLaterTodayCount,
      reviewedTodayCount,
      capturedTodayCount,
    },
    activity,
    forecast,
    growth,
    composition,
    scoreTrend,
    difficultWords,
    totals,
  };
}
