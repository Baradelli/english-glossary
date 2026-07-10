import { describe, expect, it } from "vitest";
import {
  MONTH_LABELS_PT,
  WEEKDAY_LABELS_PT,
  dayKeyDiff,
  dayOfWeek,
  formatDayKeyShort,
  localDayKey,
  localDayStartUtc,
  shiftDayKey,
} from "./localDay.js";

describe("localDayKey", () => {
  it("rolls back to the previous day west of UTC (São Paulo, +180)", () => {
    // 02:30Z is 23:30 of the day before at UTC-3.
    expect(localDayKey(new Date("2026-07-08T02:30:00.000Z"), 180)).toBe(
      "2026-07-07",
    );
  });

  it("matches the UTC date at offset 0", () => {
    expect(localDayKey(new Date("2026-07-08T02:30:00.000Z"), 0)).toBe(
      "2026-07-08",
    );
  });

  it("rolls forward to the next day east of UTC (Tokyo, -540)", () => {
    // 20:00Z is 05:00 of the NEXT day at UTC+9.
    expect(localDayKey(new Date("2026-07-08T20:00:00.000Z"), -540)).toBe(
      "2026-07-09",
    );
  });
});

describe("localDayStartUtc", () => {
  it("returns the UTC instant of local midnight", () => {
    expect(localDayStartUtc("2026-07-07", 180).toISOString()).toBe(
      "2026-07-07T03:00:00.000Z",
    );
    expect(localDayStartUtc("2026-07-07", 0).toISOString()).toBe(
      "2026-07-07T00:00:00.000Z",
    );
  });

  it("is the inverse of localDayKey for any offset", () => {
    for (const tz of [-540, 0, 180, 300]) {
      expect(localDayKey(localDayStartUtc("2026-07-07", tz), tz)).toBe(
        "2026-07-07",
      );
    }
  });
});

describe("shiftDayKey", () => {
  it("crosses month boundaries", () => {
    expect(shiftDayKey("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftDayKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses year boundaries", () => {
    expect(shiftDayKey("2025-12-31", 1)).toBe("2026-01-01");
    expect(shiftDayKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("shifts by many days at once", () => {
    expect(shiftDayKey("2026-07-09", -119)).toBe("2026-03-12");
    expect(shiftDayKey("2026-07-09", 0)).toBe("2026-07-09");
  });
});

describe("dayKeyDiff", () => {
  it("counts whole days, signed", () => {
    expect(dayKeyDiff("2026-07-07", "2026-07-09")).toBe(2);
    expect(dayKeyDiff("2026-07-09", "2026-07-07")).toBe(-2);
    expect(dayKeyDiff("2026-07-09", "2026-07-09")).toBe(0);
    expect(dayKeyDiff("2025-12-30", "2026-01-02")).toBe(3);
  });
});

describe("dayOfWeek", () => {
  it("maps known dates (0 = domingo .. 6 = sábado)", () => {
    expect(dayOfWeek("2026-07-05")).toBe(0); // sunday
    expect(dayOfWeek("2026-07-08")).toBe(3); // wednesday
    expect(dayOfWeek("2026-07-11")).toBe(6); // saturday
  });
});

describe("formatDayKeyShort", () => {
  it('renders "DD/MM"', () => {
    expect(formatDayKeyShort("2026-07-08")).toBe("08/07");
    expect(formatDayKeyShort("2025-12-31")).toBe("31/12");
  });
});

describe("pt-BR labels", () => {
  it("cover the whole week and year without Intl", () => {
    expect(WEEKDAY_LABELS_PT).toHaveLength(7);
    expect(WEEKDAY_LABELS_PT[0]).toBe("dom");
    expect(WEEKDAY_LABELS_PT[6]).toBe("sáb");
    expect(MONTH_LABELS_PT).toHaveLength(12);
    expect(MONTH_LABELS_PT[0]).toBe("jan");
    expect(MONTH_LABELS_PT[11]).toBe("dez");
  });
});
