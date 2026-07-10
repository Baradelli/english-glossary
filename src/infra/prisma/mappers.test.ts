import { describe, expect, it } from "vitest";
import type {
  ExamQuestion as PrismaExamQuestion,
  Word as PrismaWord,
} from "@prisma/client";
import { toExamQuestion, toWord } from "./mappers.js";

const baseRow: PrismaWord = {
  id: "w1",
  term: "ramble",
  termKey: "ramble",
  kind: "palavra",
  definitionEn: "x",
  definitionPt: "y",
  examples: JSON.stringify(["a", "b"]),
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
  nextReview: new Date("2026-06-19T00:00:00.000Z"),
  createdAt: new Date("2026-06-19T00:00:00.000Z"),
};

describe("toWord — examples decoding", () => {
  it("decodes the JSON-encoded examples column into a string array", () => {
    expect(toWord(baseRow).examples).toEqual(["a", "b"]);
  });

  it("throws on a corrupt examples column (not a JSON string array)", () => {
    expect(() => toWord({ ...baseRow, examples: "{}" })).toThrow();
    expect(() => toWord({ ...baseRow, examples: "[1,2]" })).toThrow();
  });
});

describe("toWord — kind", () => {
  it("carries the kind discriminator through", () => {
    expect(toWord(baseRow).kind).toBe("palavra");
    expect(toWord({ ...baseRow, kind: "expressao" }).kind).toBe("expressao");
  });
});

const baseQuestionRow: PrismaExamQuestion = {
  id: "q1",
  examId: "e1",
  wordId: "w1",
  position: 0,
  type: "mc_en_pt",
  options: JSON.stringify(["divagar", "prolixo", "atalho", "meta"]),
  prompt: 'Qual é o significado de "ramble"?',
  correctIndex: 0,
  correctAnswer: null,
  contextSentence: null,
  explanation: null,
  userAnswer: null,
  isCorrect: null,
  answeredAt: null,
};

describe("toExamQuestion — options decoding", () => {
  it("decodes the JSON-encoded options column into a string array", () => {
    const q = toExamQuestion(baseQuestionRow);
    expect(q.options).toEqual(["divagar", "prolixo", "atalho", "meta"]);
    expect(q.type).toBe("mc_en_pt");
    expect(q.correctIndex).toBe(0);
  });

  it("maps a null options column (typed/cloze) to null", () => {
    const q = toExamQuestion({
      ...baseQuestionRow,
      type: "typed",
      options: null,
      correctIndex: null,
      correctAnswer: "ramble",
    });
    expect(q.options).toBeNull();
    expect(q.correctAnswer).toBe("ramble");
  });

  it("throws on a corrupt options column (not a JSON string array)", () => {
    expect(() =>
      toExamQuestion({ ...baseQuestionRow, options: "{}" }),
    ).toThrow();
    expect(() =>
      toExamQuestion({ ...baseQuestionRow, options: "[1,2]" }),
    ).toThrow();
  });

  it("carries the answer fields through", () => {
    const answeredAt = new Date("2026-06-19T00:00:00.000Z");
    const q = toExamQuestion({
      ...baseQuestionRow,
      userAnswer: "divagar",
      isCorrect: true,
      answeredAt,
    });
    expect(q.userAnswer).toBe("divagar");
    expect(q.isCorrect).toBe(true);
    expect(q.answeredAt).toEqual(answeredAt);
  });
});
