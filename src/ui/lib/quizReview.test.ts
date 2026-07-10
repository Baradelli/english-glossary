import { describe, expect, it } from "vitest";
import {
  buildObservationSeed,
  buildOptionReview,
  type QuizReviewQuestion,
} from "./quizReview.js";

const question: QuizReviewQuestion = {
  prompt: "Choose the natural sentence.",
  options: ["wrong A", "right", "wrong B", "wrong C"],
  correctIndex: 1,
  userAnswer: "2",
  explanation: "right is natural",
  optionExplanations: [
    "wrong A has the wrong collocation",
    "right is natural",
    "wrong B changes the meaning",
    "wrong C has the wrong register",
  ],
};

describe("buildOptionReview", () => {
  it("marks the selected and correct alternatives without changing their order", () => {
    expect(buildOptionReview(question)).toEqual([
      {
        text: "wrong A",
        explanation: "wrong A has the wrong collocation",
        selected: false,
        correct: false,
      },
      {
        text: "right",
        explanation: "right is natural",
        selected: false,
        correct: true,
      },
      {
        text: "wrong B",
        explanation: "wrong B changes the meaning",
        selected: true,
        correct: false,
      },
      {
        text: "wrong C",
        explanation: "wrong C has the wrong register",
        selected: false,
        correct: false,
      },
    ]);
  });

  it("uses the legacy explanation only for the correct option", () => {
    const review = buildOptionReview({
      ...question,
      optionExplanations: null,
    });
    expect(review.map((option) => option.explanation)).toEqual([
      null,
      "right is natural",
      null,
      null,
    ]);
  });
});

describe("buildObservationSeed", () => {
  it("combines why the chosen option was wrong with why the correct one is right", () => {
    expect(buildObservationSeed(question)).toBe(
      [
        "Sua resposta (“wrong B”): wrong B changes the meaning",
        "Resposta correta (“right”): right is natural",
      ].join("\n"),
    );
  });

  it("uses only the correct explanation after a correct answer", () => {
    expect(buildObservationSeed({ ...question, userAnswer: "1" })).toBe(
      "Resposta correta (“right”): right is natural",
    );
  });
});
