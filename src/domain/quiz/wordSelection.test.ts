import { describe, expect, it } from "vitest";
import { createRng } from "./rng.js";
import {
  VOCAB_QUIZ_CAP,
  selectVocabularyWords,
  selectWeeklyWords,
  vocabularyWeight,
  type SrsWeightInput,
} from "./wordSelection.js";

const NOW = new Date("2026-07-09T12:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("selectWeeklyWords", () => {
  it("keeps only words created within the last 7 days (inclusive boundary)", () => {
    const words = [
      { id: "today", createdAt: daysAgo(0) },
      { id: "recent", createdAt: daysAgo(6.9) },
      { id: "boundary", createdAt: daysAgo(7) },
      { id: "old", createdAt: daysAgo(7.001) },
      { id: "ancient", createdAt: daysAgo(30) },
    ];
    expect(selectWeeklyWords(words, NOW).map((w) => w.id)).toEqual([
      "today",
      "recent",
      "boundary",
    ]);
  });

  it("returns empty when nothing is recent", () => {
    expect(selectWeeklyWords([{ createdAt: daysAgo(10) }], NOW)).toEqual([]);
  });
});

function srs(over: Partial<SrsWeightInput> = {}): SrsWeightInput {
  return {
    easeFactor: 2.5,
    repetitions: 3,
    nextReview: daysAgo(-5), // due in 5 days
    ...over,
  };
}

describe("vocabularyWeight", () => {
  it("adds up low ease, never-reviewed and overdue bonuses", () => {
    const struggling = srs({
      easeFactor: 1.3,
      repetitions: 0,
      nextReview: daysAgo(1),
    });
    // (3 − 1.3) + 1 + 0.5
    expect(vocabularyWeight(struggling, NOW)).toBeCloseTo(3.2);
  });

  it("caps the ease term at 3.0 and floors the result at 0.25", () => {
    const mastered = srs({ easeFactor: 3.4, repetitions: 8 });
    expect(vocabularyWeight(mastered, NOW)).toBe(0.25);
  });

  it("counts a word due exactly now as overdue", () => {
    const dueNow = srs({ nextReview: new Date(NOW.getTime()) });
    expect(vocabularyWeight(dueNow, NOW)).toBeCloseTo(0.5 + 0.5); // ease 2.5
  });
});

describe("selectVocabularyWords", () => {
  it("caps the draw at VOCAB_QUIZ_CAP", () => {
    const words = Array.from({ length: 50 }, (_, i) => ({
      id: `w${i}`,
      ...srs(),
    }));
    expect(VOCAB_QUIZ_CAP).toBe(20);
    expect(selectVocabularyWords(words, NOW, createRng(1))).toHaveLength(20);
  });

  it("returns everything when the glossary is under the cap", () => {
    const words = Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, ...srs() }));
    expect(selectVocabularyWords(words, NOW, createRng(1))).toHaveLength(5);
  });

  it("favours struggling words over mastered ones (fixed seed)", () => {
    const struggling = Array.from({ length: 20 }, (_, i) => ({
      id: `bad${i}`,
      ...srs({ easeFactor: 1.3, repetitions: 0, nextReview: daysAgo(2) }),
    }));
    const mastered = Array.from({ length: 20 }, (_, i) => ({
      id: `good${i}`,
      ...srs({ easeFactor: 3.0, repetitions: 8, nextReview: daysAgo(-30) }),
    }));
    const picked = selectVocabularyWords(
      [...struggling, ...mastered],
      NOW,
      createRng(2026),
    );
    expect(picked).toHaveLength(20);
    const badCount = picked.filter((w) => w.id.startsWith("bad")).length;
    const goodCount = picked.length - badCount;
    // Weights are 3.2 vs 0.25 (≈13×): the struggling half must dominate.
    expect(badCount).toBeGreaterThan(goodCount);
  });

  it("is deterministic for the same seed", () => {
    const words = Array.from({ length: 30 }, (_, i) => ({
      id: `w${i}`,
      ...srs({ easeFactor: 1.3 + (i % 10) * 0.15 }),
    }));
    expect(selectVocabularyWords(words, NOW, createRng(7))).toEqual(
      selectVocabularyWords(words, NOW, createRng(7)),
    );
  });
});
