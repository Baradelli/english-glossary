import { describe, expect, it } from "vitest";
import { buildReviewForecast } from "./forecast.js";

// Thursday, 2026-07-09 both in UTC and at UTC-3.
const NOW = new Date("2026-07-09T15:00:00.000Z");

describe("buildReviewForecast", () => {
  it("folds overdue reviews into today's bar and dueNowCount", () => {
    const forecast = buildReviewForecast(
      [
        new Date("2026-06-29T10:00:00.000Z"), // D−10
        new Date("2026-07-09T08:00:00.000Z"), // due today
      ],
      NOW,
      0,
    );
    expect(forecast.days[0]?.key).toBe("2026-07-09");
    expect(forecast.days[0]?.count).toBe(2);
    expect(forecast.dueNowCount).toBe(2);
    expect(forecast.dueLaterTodayCount).toBe(0);
    expect(forecast.weekTotal).toBe(2);
  });

  it("splits today's bar into due-now and due-later-today by instant", () => {
    // SM-2 preserves the time of day, so a review can be due today at 20:00
    // while `now` is 15:00 — it sits in today's bar but is not due yet
    // (due-ness compares instants, not local days).
    const forecast = buildReviewForecast(
      [
        new Date("2026-07-09T08:00:00.000Z"), // earlier today — answerable now
        new Date("2026-07-09T15:00:00.000Z"), // exactly now — answerable now
        new Date("2026-07-09T20:00:00.000Z"), // later today — not yet
      ],
      NOW,
      0,
    );
    expect(forecast.days[0]?.count).toBe(3);
    expect(forecast.dueNowCount).toBe(2);
    expect(forecast.dueLaterTodayCount).toBe(1);
  });

  it("places a UTC-early-morning instant on the LOCAL day it falls on (east)", () => {
    // 20:00Z is 05:00 of the NEXT day at UTC+9 — tomorrow, not due now.
    const forecast = buildReviewForecast(
      [new Date("2026-07-09T20:00:00.000Z")],
      new Date("2026-07-09T12:00:00.000Z"), // 21:00 local, still 2026-07-09
      -540,
    );
    expect(forecast.dueNowCount).toBe(0);
    expect(forecast.days[0]?.count).toBe(0);
    expect(forecast.days[1]?.key).toBe("2026-07-10");
    expect(forecast.days[1]?.count).toBe(1);
  });

  it("buckets D+1..D+6 and drops D+7", () => {
    const forecast = buildReviewForecast(
      [
        new Date("2026-07-10T12:00:00.000Z"), // D+1
        new Date("2026-07-12T12:00:00.000Z"), // D+3
        new Date("2026-07-15T12:00:00.000Z"), // D+6
        new Date("2026-07-16T12:00:00.000Z"), // D+7 — outside
      ],
      NOW,
      0,
    );
    expect(forecast.days.map((d) => d.count)).toEqual([0, 1, 0, 1, 0, 0, 1]);
    expect(forecast.weekTotal).toBe(3);
    expect(forecast.days[6]?.key).toBe("2026-07-15");
  });

  it("labels today as \"hoje\" and the rest with pt-BR weekdays", () => {
    const forecast = buildReviewForecast([], NOW, 0);
    expect(forecast.days).toHaveLength(7);
    expect(forecast.days[0]?.label).toBe("hoje");
    expect(forecast.days[0]?.isToday).toBe(true);
    expect(forecast.days[1]?.label).toBe("sex"); // 2026-07-10, sexta
    expect(forecast.days[2]?.label).toBe("sáb");
    expect(forecast.days[3]?.label).toBe("dom");
    expect(forecast.days[6]?.label).toBe("qua");
  });

  it("handles an empty schedule", () => {
    const forecast = buildReviewForecast([], NOW, 0);
    expect(forecast.days.every((d) => d.count === 0)).toBe(true);
    expect(forecast.dueNowCount).toBe(0);
    expect(forecast.dueLaterTodayCount).toBe(0);
    expect(forecast.weekTotal).toBe(0);
    expect(forecast.maxCount).toBe(0);
  });

  it("reports the busiest day as maxCount", () => {
    const forecast = buildReviewForecast(
      [
        new Date("2026-07-10T12:00:00.000Z"),
        new Date("2026-07-10T13:00:00.000Z"),
        new Date("2026-07-10T14:00:00.000Z"),
        new Date("2026-07-12T12:00:00.000Z"),
      ],
      NOW,
      0,
    );
    expect(forecast.maxCount).toBe(3);
  });
});
