import { describe, expect, it } from "vitest";
import {
  INITIAL_SRS_STATE,
  deriveWordState,
  reviewWord,
  type SrsState,
} from "./sm2.js";

const NOW = new Date("2026-06-19T00:00:00.000Z");

function iso(d: Date): string {
  return d.toISOString();
}

describe("INITIAL_SRS_STATE", () => {
  it("starts a brand-new word at ease 2.5, interval 0, repetitions 0", () => {
    expect(INITIAL_SRS_STATE).toEqual({
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
    });
  });
});

describe("deriveWordState (§6.1)", () => {
  it("is 'nova' when repetitions == 0, regardless of interval", () => {
    expect(deriveWordState({ repetitions: 0, intervalDays: 0 })).toBe("nova");
    expect(deriveWordState({ repetitions: 0, intervalDays: 30 })).toBe("nova");
  });

  it("is 'aprendendo' when repetitions >= 1 and interval < 21", () => {
    expect(deriveWordState({ repetitions: 1, intervalDays: 1 })).toBe(
      "aprendendo",
    );
    expect(deriveWordState({ repetitions: 5, intervalDays: 20 })).toBe(
      "aprendendo",
    );
  });

  it("is 'dominada' when interval >= 21 (and repetitions >= 1)", () => {
    expect(deriveWordState({ repetitions: 4, intervalDays: 21 })).toBe(
      "dominada",
    );
    expect(deriveWordState({ repetitions: 9, intervalDays: 200 })).toBe(
      "dominada",
    );
  });
});

describe("reviewWord — input validation", () => {
  it.each([-1, 6, 2.5, Number.NaN])(
    "throws on out-of-range / non-integer quality %p",
    (q) => {
      expect(() => reviewWord(INITIAL_SRS_STATE, q, NOW)).toThrow();
    },
  );

  it("accepts the full valid quality range 0..5", () => {
    for (const q of [0, 1, 2, 3, 4, 5]) {
      expect(() => reviewWord(INITIAL_SRS_STATE, q, NOW)).not.toThrow();
    }
  });
});

describe("reviewWord — successful answers (quality >= 3)", () => {
  it("first successful review: interval 1 day, repetitions 1, due tomorrow", () => {
    const r = reviewWord(INITIAL_SRS_STATE, 5, NOW);
    expect(r.intervalDays).toBe(1);
    expect(r.repetitions).toBe(1);
    expect(iso(r.nextReview)).toBe("2026-06-20T00:00:00.000Z");
    expect(r.state).toBe("aprendendo");
  });

  it("second successful review: interval jumps to 6 days, repetitions 2", () => {
    const afterFirst: SrsState = {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
    };
    const r = reviewWord(afterFirst, 5, NOW);
    expect(r.intervalDays).toBe(6);
    expect(r.repetitions).toBe(2);
    expect(iso(r.nextReview)).toBe("2026-06-25T00:00:00.000Z");
    expect(r.state).toBe("aprendendo");
  });

  it("third+ successful review: interval = round(prevInterval * easeFactor)", () => {
    const mature: SrsState = {
      easeFactor: 2.5,
      intervalDays: 6,
      repetitions: 2,
    };
    const r = reviewWord(mature, 5, NOW);
    // round(6 * 2.6) where ease rises 2.5 -> 2.6 on quality 5; spec uses the
    // updated ease for the multiplication.
    expect(r.intervalDays).toBe(16);
    expect(r.repetitions).toBe(3);
  });

  it("crosses into 'dominada' once the interval reaches >= 21 days", () => {
    const r = reviewWord(
      { easeFactor: 2.5, intervalDays: 10, repetitions: 3 },
      5,
      NOW,
    );
    expect(r.intervalDays).toBeGreaterThanOrEqual(21);
    expect(r.state).toBe("dominada");
  });
});

describe("reviewWord — failed answers (quality < 3) regress the word", () => {
  it("resets repetitions to 0 and interval to 1 (back to 'nova')", () => {
    const dominated: SrsState = {
      easeFactor: 2.5,
      intervalDays: 200,
      repetitions: 9,
    };
    const r = reviewWord(dominated, 1, NOW);
    expect(r.repetitions).toBe(0);
    expect(r.intervalDays).toBe(1);
    expect(r.state).toBe("nova");
    expect(iso(r.nextReview)).toBe("2026-06-20T00:00:00.000Z");
  });
});

describe("reviewWord — ease factor update (SM-2 formula)", () => {
  it("rises by 0.1 on a perfect answer (quality 5)", () => {
    const r = reviewWord(INITIAL_SRS_STATE, 5, NOW);
    expect(r.easeFactor).toBeCloseTo(2.6, 10);
  });

  it("is unchanged on quality 4", () => {
    const r = reviewWord(INITIAL_SRS_STATE, 4, NOW);
    expect(r.easeFactor).toBeCloseTo(2.5, 10);
  });

  it("drops on quality 3", () => {
    const r = reviewWord(INITIAL_SRS_STATE, 3, NOW);
    expect(r.easeFactor).toBeCloseTo(2.36, 10);
  });

  it("never falls below the 1.3 floor", () => {
    const r = reviewWord(
      { easeFactor: 1.3, intervalDays: 1, repetitions: 1 },
      0,
      NOW,
    );
    expect(r.easeFactor).toBe(1.3);
  });
});

describe("reviewWord — purity / determinism", () => {
  it("does not mutate the input state", () => {
    const input: SrsState = {
      easeFactor: 2.5,
      intervalDays: 6,
      repetitions: 2,
    };
    const snapshot = { ...input };
    reviewWord(input, 5, NOW);
    expect(input).toEqual(snapshot);
  });

  it("uses the injected date, not the real clock", () => {
    const r1 = reviewWord(INITIAL_SRS_STATE, 5, NOW);
    const r2 = reviewWord(
      INITIAL_SRS_STATE,
      5,
      new Date("2030-01-01T00:00:00.000Z"),
    );
    expect(iso(r1.nextReview)).toBe("2026-06-20T00:00:00.000Z");
    expect(iso(r2.nextReview)).toBe("2030-01-02T00:00:00.000Z");
  });
});
