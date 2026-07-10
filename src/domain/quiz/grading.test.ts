import { describe, expect, it } from "vitest";
import { computeScore, gradeAnswer, isQuizExam, type AnswerKey } from "./grading.js";

function mc(correctIndex: number, type: AnswerKey["type"] = "mc_en_pt"): AnswerKey {
  return { type, correctIndex, correctAnswer: null };
}

function text(correctAnswer: string, type: AnswerKey["type"] = "typed"): AnswerKey {
  return { type, correctIndex: null, correctAnswer };
}

describe("gradeAnswer — multiple choice", () => {
  it('compares the chosen index as a string "0".."3"', () => {
    expect(gradeAnswer(mc(2), "2")).toBe(true);
    expect(gradeAnswer(mc(2), "1")).toBe(false);
    expect(gradeAnswer(mc(0), "0")).toBe(true);
  });

  it("tolerates surrounding whitespace in the raw answer", () => {
    expect(gradeAnswer(mc(3), " 3 ")).toBe(true);
  });

  it("grades ai_context like any multiple choice", () => {
    expect(gradeAnswer(mc(1, "ai_context"), "1")).toBe(true);
    expect(gradeAnswer(mc(1, "ai_context"), "2")).toBe(false);
  });

  it("never grades correct on a malformed key (null index)", () => {
    expect(gradeAnswer({ type: "mc_pt_en", correctIndex: null, correctAnswer: null }, "0")).toBe(
      false,
    );
  });
});

describe("gradeAnswer — typed and cloze", () => {
  it("accepts exact and one-typo answers via typo tolerance", () => {
    expect(gradeAnswer(text("ramble"), "ramble")).toBe(true);
    expect(gradeAnswer(text("ramble"), "rumble")).toBe(true); // 1 edit
    expect(gradeAnswer(text("ramble"), "rumbles")).toBe(false); // 2 edits
    expect(gradeAnswer(text("rambled", "cloze"), "RAMBLED ")).toBe(true);
  });

  it("cloze also accepts the headword when the key carries it", () => {
    const key: AnswerKey = {
      type: "cloze",
      correctIndex: null,
      correctAnswer: "walking",
      term: "walk",
    };
    expect(gradeAnswer(key, "walking")).toBe(true); // the surface form
    expect(gradeAnswer(key, "walk")).toBe(true); // the verbete itself
    expect(gradeAnswer(key, "walks")).toBe(true); // 1 typo from the verbete
    expect(gradeAnswer(key, "run")).toBe(false);
  });

  it("typed ignores the term field — its answer IS the headword already", () => {
    expect(
      gradeAnswer(
        { type: "typed", correctIndex: null, correctAnswer: "walking", term: "walk" },
        "walk",
      ),
    ).toBe(false);
  });

  it("never grades correct on a malformed key (null answer)", () => {
    expect(
      gradeAnswer({ type: "cloze", correctIndex: null, correctAnswer: null }, "anything"),
    ).toBe(false);
    expect(
      gradeAnswer(
        { type: "cloze", correctIndex: null, correctAnswer: null, term: "walk" },
        "walk",
      ),
    ).toBe(false);
  });
});

describe("computeScore", () => {
  it("rounds 100·correct/total", () => {
    expect(computeScore([true, true, false])).toBe(67);
    expect(computeScore([true, false, false])).toBe(33);
    expect(computeScore([true, true, true])).toBe(100);
    expect(computeScore([false])).toBe(0);
  });

  it("scores an empty quiz as 0", () => {
    expect(computeScore([])).toBe(0);
  });
});

describe("isQuizExam", () => {
  it("recognises the two quiz statuses and rejects the legacy ones", () => {
    expect(isQuizExam({ status: "em_andamento" })).toBe(true);
    expect(isQuizExam({ status: "finalizada" })).toBe(true);
    expect(isQuizExam({ status: "gerada" })).toBe(false);
    expect(isQuizExam({ status: "respondida" })).toBe(false);
    expect(isQuizExam({ status: "corrigida" })).toBe(false);
  });
});
