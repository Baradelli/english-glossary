import { describe, expect, it } from "vitest";
import {
  HEATMAP_WEEKS,
  buildActivityCalendar,
  computeStreak,
  type ActivityCalendar,
  type HeatmapDay,
} from "./activity.js";
import { shiftDayKey } from "./localDay.js";

// Thursday, 2026-07-09 local at UTC-3 (offset +180, São Paulo).
const NOW = new Date("2026-07-09T15:00:00.000Z");
const TZ = 180;

/** Local noon of a "YYYY-MM-DD" local day at the test offset (UTC-3). */
function at(localDay: string): Date {
  return new Date(`${localDay}T12:00:00.000Z`); // 09:00 local — same local day
}

function build(
  overrides: Partial<Parameters<typeof buildActivityCalendar>[0]> = {},
): ActivityCalendar {
  return buildActivityCalendar({
    reviewDates: [],
    captureDates: [],
    now: NOW,
    tzOffsetMinutes: TZ,
    ...overrides,
  });
}

function day(calendar: ActivityCalendar, key: string): HeatmapDay {
  const found = calendar.weeks.flat().find((d) => d.key === key);
  if (!found) throw new Error(`test setup: day ${key} not in the grid`);
  return found;
}

describe("computeStreak", () => {
  it("counts consecutive days ending today when today is active", () => {
    const active = new Set(["2026-07-07", "2026-07-08", "2026-07-09"]);
    expect(computeStreak(active, "2026-07-09")).toBe(3);
  });

  it("falls back to a streak ending yesterday when today is inactive", () => {
    const active = new Set(["2026-07-07", "2026-07-08"]);
    expect(computeStreak(active, "2026-07-09")).toBe(2);
  });

  it("returns 0 when neither today nor yesterday is active", () => {
    expect(computeStreak(new Set(["2026-07-07"]), "2026-07-09")).toBe(0);
    expect(computeStreak(new Set(), "2026-07-09")).toBe(0);
  });

  it("stops at a gap", () => {
    const active = new Set(["2026-07-09", "2026-07-07", "2026-07-06"]);
    expect(computeStreak(active, "2026-07-09")).toBe(1);
  });
});

describe("buildActivityCalendar", () => {
  it("renders an all-zero grid with no events", () => {
    const calendar = build();
    expect(calendar.weeks).toHaveLength(HEATMAP_WEEKS);
    for (const week of calendar.weeks) expect(week).toHaveLength(7);
    expect(calendar.weeks.flat().every((d) => d.level === 0)).toBe(true);
    expect(calendar.streakDays).toBe(0);
    expect(calendar.todayTotal).toBe(0);
    expect(calendar.totalActions).toBe(0);
    expect(calendar.activeDayCount).toBe(0);
    expect(day(calendar, "2026-07-09").isToday).toBe(true);
    expect(
      calendar.weeks.flat().filter((d) => d.isToday),
    ).toHaveLength(1);
  });

  it("assigns a UTC-early-morning event to the previous LOCAL day (streak counts it)", () => {
    // 00:30Z is 21:30 of 2026-07-08 at UTC-3.
    const calendar = build({
      reviewDates: [new Date("2026-07-09T00:30:00.000Z"), at("2026-07-09")],
    });
    expect(day(calendar, "2026-07-08").reviewCount).toBe(1);
    expect(day(calendar, "2026-07-09").reviewCount).toBe(1);
    expect(calendar.streakDays).toBe(2);
  });

  it("preserves the streak when today is still inactive but yesterday was active", () => {
    const calendar = build({
      captureDates: [at("2026-07-07"), at("2026-07-08")],
    });
    expect(calendar.streakDays).toBe(2);
    expect(calendar.todayTotal).toBe(0);
  });

  it("breaks the streak on a gap", () => {
    const calendar = build({
      reviewDates: [at("2026-07-09"), at("2026-07-07")],
    });
    expect(calendar.streakDays).toBe(1);
  });

  it("quantizes levels 1:1 on sparse calendars (busiest day <= 4)", () => {
    const calendar = build({
      reviewDates: [
        at("2026-07-06"),
        at("2026-07-07"), at("2026-07-07"),
        at("2026-07-08"), at("2026-07-08"), at("2026-07-08"),
      ],
      captureDates: [
        at("2026-07-09"), at("2026-07-09"), at("2026-07-09"), at("2026-07-09"),
      ],
    });
    expect(day(calendar, "2026-07-06").level).toBe(1);
    expect(day(calendar, "2026-07-07").level).toBe(2);
    expect(day(calendar, "2026-07-08").level).toBe(3);
    expect(day(calendar, "2026-07-09").level).toBe(4);
  });

  it("scales levels against the busiest day when it exceeds 4", () => {
    const eight = Array.from({ length: 8 }, () => at("2026-07-08"));
    const calendar = build({
      reviewDates: [...eight, at("2026-07-07")],
      captureDates: [
        at("2026-07-06"), at("2026-07-06"),
        at("2026-07-06"), at("2026-07-06"),
      ],
    });
    expect(day(calendar, "2026-07-08").level).toBe(4); // ceil(4·8/8)
    expect(day(calendar, "2026-07-07").level).toBe(1); // ceil(4·1/8)
    expect(day(calendar, "2026-07-06").level).toBe(2); // ceil(4·4/8)
  });

  it("keeps reviews and captures as separate counts", () => {
    const calendar = build({
      reviewDates: [at("2026-07-09"), at("2026-07-09")],
      captureDates: [at("2026-07-09")],
    });
    const today = day(calendar, "2026-07-09");
    expect(today.reviewCount).toBe(2);
    expect(today.captureCount).toBe(1);
    expect(today.total).toBe(3);
    expect(calendar.todayTotal).toBe(3);
    expect(calendar.activeDayCount).toBe(1);
  });

  it("ignores events outside the window", () => {
    const calendar = build({
      reviewDates: [at("2025-01-01")], // long before the 18-week window
      captureDates: [at("2026-07-20")], // after today
    });
    expect(calendar.totalActions).toBe(0);
    expect(calendar.activeDayCount).toBe(0);
    expect(calendar.streakDays).toBe(0);
  });

  it("extends the streak past the window start (never capped at 18 weeks)", () => {
    // 130 consecutive active days ending today — longer than the 18-week
    // (126-day) grid. The grid still windows itself, but the streak must
    // walk through the pre-window history.
    const streakLength = 130;
    const reviewDates = Array.from({ length: streakLength }, (_, i) =>
      at(shiftDayKey("2026-07-09", -i)),
    );
    const calendar = build({ reviewDates });
    expect(calendar.streakDays).toBe(streakLength);
    expect(calendar.weeks).toHaveLength(HEATMAP_WEEKS); // grid untouched
  });

  it("marks days after today as out of range", () => {
    const calendar = build();
    // Today is a Thursday; Friday and Saturday of the last column are future.
    expect(day(calendar, "2026-07-10").inRange).toBe(false);
    expect(day(calendar, "2026-07-11").inRange).toBe(false);
    expect(day(calendar, "2026-07-09").inRange).toBe(true);
    const lastColumn = calendar.weeks[calendar.weeks.length - 1];
    expect(lastColumn?.[4]?.isToday).toBe(true); // row 4 = quinta
  });

  it("emits month labels when the column's sunday changes month", () => {
    // now 2026-07-09, offset 0 → sundays run 2026-03-08 .. 2026-07-05.
    const calendar = buildActivityCalendar({
      reviewDates: [],
      captureDates: [],
      now: new Date("2026-07-09T12:00:00.000Z"),
      tzOffsetMinutes: 0,
    });
    expect(calendar.monthLabels).toEqual([
      { weekIndex: 0, label: "mar" },
      { weekIndex: 4, label: "abr" },
      { weekIndex: 8, label: "mai" },
      { weekIndex: 13, label: "jun" },
      { weekIndex: 17, label: "jul" },
    ]);
  });

  it("suppresses a month label closer than 3 columns to the previous one", () => {
    // now 2026-07-29, offset 0 → sundays run 2026-03-29 .. 2026-07-26; the
    // april change lands on column 1, one column after "mar" → suppressed.
    const calendar = buildActivityCalendar({
      reviewDates: [],
      captureDates: [],
      now: new Date("2026-07-29T12:00:00.000Z"),
      tzOffsetMinutes: 0,
    });
    expect(calendar.monthLabels).toEqual([
      { weekIndex: 0, label: "mar" },
      { weekIndex: 5, label: "mai" },
      { weekIndex: 10, label: "jun" },
      { weekIndex: 14, label: "jul" },
    ]);
  });

  it("honours a custom week count", () => {
    const calendar = build({ weeks: 4 });
    expect(calendar.weeks).toHaveLength(4);
    // Window start: sunday 3 weeks before the current week's sunday.
    expect(calendar.weeks[0]?.[0]?.key).toBe("2026-06-14");
  });
});
