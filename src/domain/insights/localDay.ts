/**
 * Local civil days for the dashboards. Every timestamp in the database is a
 * UTC instant, but streaks, heatmaps and forecasts speak in the user's LOCAL
 * day ("I studied on the 7th"). A day is identified by a {@link DayKey}
 * ("YYYY-MM-DD"); the caller always injects `now` and the timezone offset —
 * no clock and no Intl in here, so everything stays pure and deterministic.
 *
 * Offset convention follows `Date.prototype.getTimezoneOffset()`: MINUTES to
 * ADD to local time to reach UTC, positive WEST of Greenwich (São Paulo is
 * +180, Tokyo is -540). The page captures it once with
 * `new Date().getTimezoneOffset()`.
 *
 * Known limitation (documented, accepted): a single fixed offset is applied
 * to the whole window, so instants recorded across a DST transition may land
 * one day off. Brazil currently has no DST and the app is single-user, so the
 * simplicity wins.
 */

/** A local civil day, formatted "YYYY-MM-DD". Sorts chronologically as a string. */
export type DayKey = string;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The local day an instant falls on, for the given offset (see module doc). */
export function localDayKey(instant: Date, tzOffsetMinutes: number): DayKey {
  return new Date(instant.getTime() - tzOffsetMinutes * MINUTE_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * The UTC instant at which the local day starts (local midnight). Inverse of
 * {@link localDayKey}: `localDayKey(localDayStartUtc(key, tz), tz) === key`.
 */
export function localDayStartUtc(key: DayKey, tzOffsetMinutes: number): Date {
  return new Date(keyToUtc(key) + tzOffsetMinutes * MINUTE_MS);
}

/** UTC midnight of a key, in epoch milliseconds. */
function keyToUtc(key: DayKey): number {
  return Date.UTC(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
  );
}

/** The key `days` days after `key` (negative shifts backwards). Handles month/year rollover via Date.UTC. */
export function shiftDayKey(key: DayKey, days: number): DayKey {
  return new Date(keyToUtc(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function dayKeyDiff(from: DayKey, to: DayKey): number {
  return Math.round((keyToUtc(to) - keyToUtc(from)) / DAY_MS);
}

/** Day of the week of a key: 0 = domingo .. 6 = sábado. */
export function dayOfWeek(key: DayKey): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

/** Short pt-BR date for axis/tooltips: "2026-07-08" → "08/07". */
export function formatDayKeyShort(key: DayKey): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

/** Weekday labels, indexed by {@link dayOfWeek} (0 = domingo). No Intl — fixed pt-BR. */
export const WEEKDAY_LABELS_PT = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sáb",
] as const;

/** Month labels, indexed by month - 1 (0 = janeiro). No Intl — fixed pt-BR. */
export const MONTH_LABELS_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;
