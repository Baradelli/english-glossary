/**
 * Activity calendar (GitHub-style heatmap) and study streak. Columns are
 * weeks, rows are local days sunday→saturday; the last column is the current
 * week and days after today render as out of range. Reviews and captures are
 * counted separately so the tooltip can say "3 revisões · 1 captura". Pure:
 * `now` and the timezone offset are always injected (see localDay.ts).
 */

import {
  MONTH_LABELS_PT,
  dayOfWeek,
  localDayKey,
  shiftDayKey,
  type DayKey,
} from "./localDay.js";

/** Weeks (columns) shown by the heatmap — ~4 months fits the max-w-4xl shell. */
export const HEATMAP_WEEKS = 18;

/** Minimum columns between two month labels; closer ones are suppressed. */
const MONTH_LABEL_MIN_GAP = 3;

export interface HeatmapDay {
  readonly key: DayKey;
  readonly reviewCount: number;
  readonly captureCount: number;
  readonly total: number;
  /** Color ramp intensity, 0 (no activity) .. 4 (busiest). */
  readonly level: number;
  readonly isToday: boolean;
  /** False for days after today — the grid still renders them, greyed out. */
  readonly inRange: boolean;
}

/** A month label anchored to the column whose sunday starts that month. */
export interface HeatmapMonthLabel {
  readonly weekIndex: number;
  readonly label: string;
}

export interface ActivityCalendar {
  /** `weeks[i][d]`: column i (oldest first), row d (0 = domingo .. 6 = sábado). */
  readonly weeks: readonly (readonly HeatmapDay[])[];
  readonly monthLabels: readonly HeatmapMonthLabel[];
  /**
   * Consecutive active days ending today/yesterday. Computed from EVERY input
   * date at or before today — not just the heatmap window — so a streak longer
   * than the window is never capped (feed the full history in).
   */
  readonly streakDays: number;
  readonly todayTotal: number;
  /** Sum of reviews + captures inside the window. */
  readonly totalActions: number;
  /** Days inside the window with at least one action. */
  readonly activeDayCount: number;
}

export interface ActivityCalendarInput {
  /**
   * `ReviewLog.reviewedAt` instants (reviews AND graded quiz answers). Pass
   * the FULL history: the grid windows itself, but the streak must be able to
   * walk past the window's start.
   */
  readonly reviewDates: readonly Date[];
  /** `WordSighting.seenAt` instants — the first sighting covers the capture itself. */
  readonly captureDates: readonly Date[];
  readonly now: Date;
  readonly tzOffsetMinutes: number;
  /** Columns to render; defaults to {@link HEATMAP_WEEKS}. */
  readonly weeks?: number;
}

/**
 * Consecutive active local days ending today — or ending YESTERDAY when today
 * has no activity yet (the current day in progress must not zero the streak).
 * Neither today nor yesterday active → 0.
 */
export function computeStreak(activeDays: ReadonlySet<DayKey>, today: DayKey): number {
  let cursor = activeDays.has(today) ? today : shiftDayKey(today, -1);
  let streak = 0;
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

/**
 * Heatmap color level for a day. Sparse calendars (busiest day ≤ 4 actions)
 * map count → level directly so "1 action" is never washed out; busier ones
 * scale linearly against the busiest day.
 */
function levelFor(total: number, maxTotal: number): number {
  if (total === 0) return 0;
  if (maxTotal <= 4) return Math.min(total, 4);
  return Math.ceil((4 * total) / maxTotal);
}

/**
 * Builds the full calendar. The window starts on the sunday `(weeks - 1) * 7`
 * days before the current week's sunday and ends on the current week's
 * saturday; events outside it are ignored BY THE GRID (days after today are
 * kept in it with `inRange: false`), but the streak counts every event day at
 * or before today, so pre-window history still extends it.
 */
export function buildActivityCalendar(
  input: ActivityCalendarInput,
): ActivityCalendar {
  const weeksCount = input.weeks ?? HEATMAP_WEEKS;
  const today = localDayKey(input.now, input.tzOffsetMinutes);
  const currentSunday = shiftDayKey(today, -dayOfWeek(today));
  const startSunday = shiftDayKey(currentSunday, -(weeksCount - 1) * 7);
  const endSaturday = shiftDayKey(currentSunday, 6);

  const inWindow = (key: DayKey): boolean =>
    key >= startSunday && key <= endSaturday && key <= today;

  const reviewsByDay = new Map<DayKey, number>();
  const capturesByDay = new Map<DayKey, number>();
  // Every active day at or before today, window or not — the streak's input.
  const streakDays = new Set<DayKey>();
  const tally = (dates: readonly Date[], counts: Map<DayKey, number>): void => {
    for (const date of dates) {
      const key = localDayKey(date, input.tzOffsetMinutes);
      if (key <= today) streakDays.add(key);
      if (!inWindow(key)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  };
  tally(input.reviewDates, reviewsByDay);
  tally(input.captureDates, capturesByDay);

  const totalOf = (key: DayKey): number =>
    (reviewsByDay.get(key) ?? 0) + (capturesByDay.get(key) ?? 0);

  let maxTotal = 0;
  const activeDays = new Set<DayKey>();
  for (const key of new Set([...reviewsByDay.keys(), ...capturesByDay.keys()])) {
    const total = totalOf(key);
    if (total > 0) activeDays.add(key);
    if (total > maxTotal) maxTotal = total;
  }

  let totalActions = 0;
  const weeks: HeatmapDay[][] = [];
  const monthLabels: HeatmapMonthLabel[] = [];
  let lastLabeled: { weekIndex: number; month: number } | null = null;

  for (let w = 0; w < weeksCount; w++) {
    const sunday = shiftDayKey(startSunday, w * 7);

    // A column is labeled when its sunday's month differs from the previous
    // column's (the first column always counts as a change), unless the last
    // label sits fewer than MONTH_LABEL_MIN_GAP columns away (anti-collision).
    const month = Number(sunday.slice(5, 7));
    const previousMonth =
      w === 0 ? null : Number(shiftDayKey(sunday, -7).slice(5, 7));
    if (month !== previousMonth) {
      const label = MONTH_LABELS_PT[month - 1];
      if (
        label !== undefined &&
        (lastLabeled === null ||
          w - lastLabeled.weekIndex >= MONTH_LABEL_MIN_GAP)
      ) {
        monthLabels.push({ weekIndex: w, label });
        lastLabeled = { weekIndex: w, month };
      }
    }

    const column: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const key = shiftDayKey(sunday, d);
      const inRange = key <= today;
      const reviewCount = inRange ? (reviewsByDay.get(key) ?? 0) : 0;
      const captureCount = inRange ? (capturesByDay.get(key) ?? 0) : 0;
      const total = reviewCount + captureCount;
      totalActions += total;
      column.push({
        key,
        reviewCount,
        captureCount,
        total,
        level: levelFor(total, maxTotal),
        isToday: key === today,
        inRange,
      });
    }
    weeks.push(column);
  }

  return {
    weeks,
    monthLabels,
    streakDays: computeStreak(streakDays, today),
    todayTotal: totalOf(today),
    totalActions,
    activeDayCount: activeDays.size,
  };
}
