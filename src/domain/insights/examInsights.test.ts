import { describe, expect, it } from "vitest";
import {
  buildScoreTrend,
  rankDifficultWords,
  type ScoreTrendExam,
} from "./examInsights.js";

function exam(overrides: Partial<ScoreTrendExam> & { id: string }): ScoreTrendExam {
  return {
    type: "vocabulario",
    status: "finalizada",
    score: 80,
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("buildScoreTrend", () => {
  it("keeps only concluded exams (corrigida OR finalizada) with a score", () => {
    const trend = buildScoreTrend(
      [
        exam({ id: "e1", status: "gerada", score: null }),
        exam({ id: "e2", status: "respondida", score: null }),
        exam({ id: "e3", status: "em_andamento", score: null }),
        exam({ id: "e4", status: "corrigida", score: 70, type: "semanal" }),
        exam({ id: "e5", status: "finalizada", score: 90 }),
        exam({ id: "e6", status: "corrigida", score: null }), // AI failed to grade
      ],
      0,
    );
    expect(trend.map((p) => p.examId).sort()).toEqual(["e4", "e5"]);
  });

  it("sorts ascending by creation date regardless of input order", () => {
    const trend = buildScoreTrend(
      [
        exam({ id: "late", createdAt: new Date("2026-07-08T12:00:00.000Z"), score: 50 }),
        exam({ id: "early", createdAt: new Date("2026-07-02T12:00:00.000Z"), score: 100 }),
        exam({ id: "mid", createdAt: new Date("2026-07-05T12:00:00.000Z"), score: 75 }),
      ],
      0,
    );
    expect(trend.map((p) => p.examId)).toEqual(["early", "mid", "late"]);
    expect(trend.map((p) => p.score)).toEqual([100, 75, 50]);
  });

  it("carries the exam type and the LOCAL day key", () => {
    const trend = buildScoreTrend(
      [
        exam({
          id: "e1",
          type: "semanal",
          status: "corrigida",
          score: 60,
          // 01:00Z is 22:00 of 2026-07-08 at UTC-3.
          createdAt: new Date("2026-07-09T01:00:00.000Z"),
        }),
      ],
      180,
    );
    expect(trend).toEqual([
      { key: "2026-07-08", score: 60, examId: "e1", type: "semanal" },
    ]);
  });
});

describe("rankDifficultWords", () => {
  it("does NOT double-count an exam miss mirrored as a quality-2 review log", () => {
    // A quiz miss writes BOTH rows; the word missed once must total 1, not 2.
    const stats = rankDifficultWords(
      [{ wordId: "w1", correct: false }],
      [{ wordId: "w1", quality: 2 }],
    );
    expect(stats).toEqual([
      { wordId: "w1", examErrors: 1, failedReviews: 1, totalMisses: 1 },
    ]);
  });

  it("orders by failedReviews desc, then examErrors desc, then wordId asc", () => {
    const stats = rankDifficultWords(
      [
        { wordId: "w-tie-more-exam", correct: false },
        { wordId: "w-tie-more-exam", correct: false },
        { wordId: "w-few", correct: false },
      ],
      [
        { wordId: "w-many", quality: 0 },
        { wordId: "w-many", quality: 1 },
        { wordId: "w-many", quality: 2 },
        { wordId: "w-tie-more-exam", quality: 2 },
        { wordId: "w-tie-a", quality: 2 },
        { wordId: "w-tie-b", quality: 2 },
        { wordId: "w-few", quality: 2 },
      ],
    );
    expect(stats.map((s) => s.wordId)).toEqual([
      "w-many", // 3 failed reviews
      "w-tie-more-exam", // 1 failed review, 2 exam errors
      "w-few", // 1 failed review, 1 exam error
      "w-tie-a", // 1 failed review, 0 exam errors — id ties broken asc
      "w-tie-b",
    ]);
  });

  it("ignores passing reviews (quality 3..5) and correct exam answers", () => {
    const stats = rankDifficultWords(
      [{ wordId: "w1", correct: true }],
      [
        { wordId: "w1", quality: 3 },
        { wordId: "w1", quality: 4 },
        { wordId: "w1", quality: 5 },
      ],
    );
    expect(stats).toEqual([]);
  });

  it("includes a word with exam errors but no failed reviews (legacy exams)", () => {
    const stats = rankDifficultWords(
      [{ wordId: "legacy", correct: false }],
      [],
    );
    expect(stats).toEqual([
      { wordId: "legacy", examErrors: 1, failedReviews: 0, totalMisses: 0 },
    ]);
  });

  it("applies the limit (default 5)", () => {
    const logs = ["a", "b", "c", "d", "e", "f", "g"].map((wordId) => ({
      wordId,
      quality: 2,
    }));
    expect(rankDifficultWords([], logs)).toHaveLength(5);
    expect(rankDifficultWords([], logs, 2).map((s) => s.wordId)).toEqual([
      "a",
      "b",
    ]);
  });
});
