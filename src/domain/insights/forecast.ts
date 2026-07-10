/**
 * Review forecast for the next 7 local days. Everything already overdue
 * (nextReview on or before today) accumulates in TODAY's bar — the learner
 * cares about "what's waiting for me now", not about how late it is. Pure:
 * `now` and the timezone offset are always injected (see localDay.ts).
 */

import {
  WEEKDAY_LABELS_PT,
  dayKeyDiff,
  dayOfWeek,
  localDayKey,
  shiftDayKey,
  type DayKey,
} from "./localDay.js";

/** Days covered by the forecast: today + the next six. */
const FORECAST_DAYS = 7;

export interface ForecastDay {
  readonly key: DayKey;
  /** "hoje" for the first bar; pt-BR weekday ("sex") for the rest. */
  readonly label: string;
  readonly count: number;
  readonly isToday: boolean;
}

export interface ReviewForecast {
  /** Exactly 7 entries; `days[0]` is today. */
  readonly days: readonly ForecastDay[];
  /**
   * Reviews whose instant is at or before `now` (`nextReview <= now`) — the
   * words already due for study, surfaced in the dashboard's "hoje" band.
   */
  readonly dueNowCount: number;
  /**
   * Reviews due later TODAY (instant after `now` but on today's local day).
   * They sit in today's bar with the overdue ones, but are not answerable yet.
   */
  readonly dueLaterTodayCount: number;
  /** Sum across the 7 days. */
  readonly weekTotal: number;
  /** Busiest day's count (0 when the week is empty) — the bars' scale. */
  readonly maxCount: number;
}

/** Builds the forecast from `Word.nextReview` instants. Dates beyond day 6 are ignored. */
export function buildReviewForecast(
  nextReviews: readonly Date[],
  now: Date,
  tzOffsetMinutes: number,
): ReviewForecast {
  const today = localDayKey(now, tzOffsetMinutes);
  const counts = new Array<number>(FORECAST_DAYS).fill(0);
  let dueNowCount = 0;
  let dueLaterTodayCount = 0;

  const lastKey = shiftDayKey(today, FORECAST_DAYS - 1);
  for (const nextReview of nextReviews) {
    const key = localDayKey(nextReview, tzOffsetMinutes);
    if (key <= today) {
      // Today's bar folds everything overdue together, but only instants at
      // or before `now` are due right now — SM-2 preserves the time of day, so
      // due-ness compares instants, not local days.
      counts[0] = (counts[0] ?? 0) + 1;
      if (nextReview.getTime() <= now.getTime()) {
        dueNowCount += 1;
      } else {
        dueLaterTodayCount += 1;
      }
    } else if (key <= lastKey) {
      const index = dayKeyDiff(today, key);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    // Beyond the window: ignored.
  }

  const days: ForecastDay[] = counts.map((count, index) => {
    const key = shiftDayKey(today, index);
    return {
      key,
      label: index === 0 ? "hoje" : (WEEKDAY_LABELS_PT[dayOfWeek(key)] ?? ""),
      count,
      isToday: index === 0,
    };
  });

  return {
    days,
    dueNowCount,
    dueLaterTodayCount,
    weekTotal: counts.reduce((sum, count) => sum + count, 0),
    maxCount: Math.max(...counts),
  };
}
