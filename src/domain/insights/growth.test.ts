import { describe, expect, it } from "vitest";
import { shiftDayKey } from "./localDay.js";
import { MAX_GROWTH_POINTS, buildVocabGrowth } from "./growth.js";

const NOW = new Date("2026-07-09T15:00:00.000Z");
const TODAY = "2026-07-09";

/** Noon UTC of a day key — offset 0 keeps local day == UTC day in tests. */
function at(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

describe("buildVocabGrowth", () => {
  it("accumulates monotonically, one point per capture day plus today", () => {
    const growth = buildVocabGrowth(
      [at("2026-07-01"), at("2026-07-03"), at("2026-07-03"), at("2026-07-06")],
      NOW,
      0,
    );
    expect(growth.points).toEqual([
      { key: "2026-07-01", cumulative: 1 },
      { key: "2026-07-03", cumulative: 3 },
      { key: "2026-07-06", cumulative: 4 },
      { key: TODAY, cumulative: 4 },
    ]);
    expect(growth.totalWords).toBe(4);
    expect(growth.firstKey).toBe("2026-07-01");
    expect(growth.spanDays).toBe(9); // 1st..9th inclusive
  });

  it("collapses same-day captures into a single point", () => {
    const growth = buildVocabGrowth(
      [at(TODAY), at(TODAY), at(TODAY)],
      NOW,
      0,
    );
    expect(growth.points).toEqual([{ key: TODAY, cumulative: 3 }]);
    expect(growth.spanDays).toBe(1);
  });

  it("handles a single word captured in the past", () => {
    const growth = buildVocabGrowth([at("2026-07-05")], NOW, 0);
    expect(growth.points).toEqual([
      { key: "2026-07-05", cumulative: 1 },
      { key: TODAY, cumulative: 1 },
    ]);
    expect(growth.totalWords).toBe(1);
    expect(growth.spanDays).toBe(5);
  });

  it("handles an empty glossary", () => {
    const growth = buildVocabGrowth([], NOW, 0);
    expect(growth.points).toEqual([]);
    expect(growth.totalWords).toBe(0);
    expect(growth.firstKey).toBeNull();
    expect(growth.spanDays).toBe(0);
  });

  it("downsamples long histories preserving first and last points", () => {
    const days = 200;
    const createdAts = Array.from({ length: days }, (_, i) =>
      at(shiftDayKey(TODAY, -(days - 1 - i))),
    );
    const growth = buildVocabGrowth(createdAts, NOW, 0);
    expect(growth.points).toHaveLength(MAX_GROWTH_POINTS);
    expect(growth.points[0]).toEqual({
      key: shiftDayKey(TODAY, -(days - 1)),
      cumulative: 1,
    });
    expect(growth.points[growth.points.length - 1]).toEqual({
      key: TODAY,
      cumulative: days,
    });
    // Still monotonic after sampling.
    for (let i = 1; i < growth.points.length; i++) {
      const previous =
        growth.points[i - 1]?.cumulative ?? Number.POSITIVE_INFINITY;
      expect(growth.points[i]?.cumulative ?? 0).toBeGreaterThan(previous);
    }
    expect(growth.totalWords).toBe(days);
    expect(growth.spanDays).toBe(days);
  });
});
