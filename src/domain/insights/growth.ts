/**
 * Cumulative vocabulary growth from `Word.createdAt`. The curve is HONEST:
 * one point per local day that had at least one capture, plus a final point
 * at today — no historical state reconstruction (ReviewLog cannot replay past
 * SRS states without lying; the per-state composition is shown elsewhere as a
 * "composição atual" bar). Pure: `now` and the offset are always injected.
 */

import { dayKeyDiff, localDayKey, type DayKey } from "./localDay.js";

/** Cap on rendered points; longer histories are downsampled uniformly. */
export const MAX_GROWTH_POINTS = 120;

export interface GrowthPoint {
  readonly key: DayKey;
  /** Words captured up to and including this day. */
  readonly cumulative: number;
}

export interface VocabGrowth {
  readonly points: readonly GrowthPoint[];
  readonly totalWords: number;
  /** Local day of the first capture; null when the glossary is empty. */
  readonly firstKey: DayKey | null;
  /** Days covered, first capture through today inclusive (1 = single day; 0 = empty). */
  readonly spanDays: number;
}

/** Builds the cumulative curve. An empty glossary yields no points. */
export function buildVocabGrowth(
  createdAts: readonly Date[],
  now: Date,
  tzOffsetMinutes: number,
): VocabGrowth {
  const today = localDayKey(now, tzOffsetMinutes);

  const capturesByDay = new Map<DayKey, number>();
  for (const createdAt of createdAts) {
    const key = localDayKey(createdAt, tzOffsetMinutes);
    capturesByDay.set(key, (capturesByDay.get(key) ?? 0) + 1);
  }

  const orderedDays = [...capturesByDay.keys()].sort();
  const firstKey = orderedDays[0];
  if (firstKey === undefined) {
    return { points: [], totalWords: 0, firstKey: null, spanDays: 0 };
  }

  let cumulative = 0;
  const points: GrowthPoint[] = orderedDays.map((key) => {
    cumulative += capturesByDay.get(key) ?? 0;
    return { key, cumulative };
  });

  const lastPoint = points[points.length - 1];
  if (lastPoint && lastPoint.key !== today) {
    points.push({ key: today, cumulative });
  }

  return {
    points: downsample(points, MAX_GROWTH_POINTS),
    totalWords: cumulative,
    firstKey,
    spanDays: dayKeyDiff(firstKey, today) + 1,
  };
}

/**
 * Uniform downsample to at most `max` points, always keeping the first and
 * the last (the extremes anchor the axis labels and the final total).
 */
function downsample(
  points: readonly GrowthPoint[],
  max: number,
): readonly GrowthPoint[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const sampled: GrowthPoint[] = [];
  for (let index = 0; index < max; index++) {
    const point = points[Math.round(index * step)];
    if (point) sampled.push(point);
  }
  return sampled;
}
