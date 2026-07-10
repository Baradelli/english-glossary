import { describe, expect, it } from "vitest";
import { buildAiQuizQuestions, type QuizWordInput } from "./aiGeneration.js";
import type { AiQuizItem } from "./aiQuiz.js";

const words: QuizWordInput[] = [
  {
    id: "w-ramble",
    term: "ramble",
    kind: "palavra",
    definitionEn: "to talk at length",
    definitionPt: "divagar",
    observations: [],
    contextSentences: ["Sorry, I tend to ramble."],
  },
  {
    id: "w-cake",
    term: "piece of cake",
    kind: "expressao",
    definitionEn: "very easy",
    definitionPt: "muito fácil",
    observations: [],
    contextSentences: [],
  },
];

function item(over: Partial<AiQuizItem> = {}): AiQuizItem {
  return {
    term: "ramble",
    prompt: 'O que significa "ramble"?',
    options: ["divagar", "correr", "dormir", "comer"],
    optionExplanations: [
      "É o significado correto de ramble.",
      "Correr significa run.",
      "Dormir significa sleep.",
      "Comer significa eat.",
    ],
    correctIndex: 0,
    explanation: "porque ramble = divagar",
    ...over,
  };
}

const SEED = 7;

describe("buildAiQuizQuestions", () => {
  it("turns matched items into ai_context questions, one per word", () => {
    const questions = buildAiQuizQuestions({
      items: [item(), item({ term: "piece of cake", options: ["muito fácil", "difícil", "caro", "longe"] })],
      words,
      seed: SEED,
    });

    expect(questions).toHaveLength(2);
    expect(questions.map((q) => q.position)).toEqual([0, 1]);
    for (const q of questions) {
      expect(q.type).toBe("ai_context");
      expect(q.options).toHaveLength(4);
      expect(q.correctAnswer).toBeNull();
    }
    expect(new Set(questions.map((q) => q.wordId)).size).toBe(2);
  });

  it("matches terms case-insensitively and attaches the first context sentence", () => {
    const [q] = buildAiQuizQuestions({
      items: [item({ term: "RAMBLE" })],
      words,
      seed: SEED,
    });
    expect(q?.wordId).toBe("w-ramble");
    expect(q?.contextSentence).toBe("Sorry, I tend to ramble.");
  });

  it("keeps correctIndex pointing at the AI's correct option after reshuffling", () => {
    const questions = buildAiQuizQuestions({
      items: [item({ correctIndex: 2 })], // "dormir" is correct
      words,
      seed: SEED,
    });
    expect(questions[0]?.options?.[questions[0]?.correctIndex ?? -1]).toBe("dormir");
  });

  it("keeps each explanation aligned with its option after reshuffling", () => {
    const source = item({ correctIndex: 2 });
    const expectedByOption = new Map(
      source.options.map((option, index) => [
        option,
        source.optionExplanations[index],
      ]),
    );
    const [question] = buildAiQuizQuestions({
      items: [source],
      words,
      seed: SEED,
    });

    question?.options?.forEach((option, index) => {
      expect(question.optionExplanations?.[index]).toBe(
        expectedByOption.get(option),
      );
    });
    expect(question?.explanation).toBe("Dormir significa sleep.");
  });

  it("drops an item whose term matches no word", () => {
    const questions = buildAiQuizQuestions({
      items: [item({ term: "ghost" })],
      words,
      seed: SEED,
    });
    expect(questions).toHaveLength(0);
  });

  it("keeps only the first item for a repeated term (one question per word)", () => {
    const questions = buildAiQuizQuestions({
      items: [item(), item({ prompt: "segunda?" })],
      words: [words[0] as QuizWordInput],
      seed: SEED,
    });
    expect(questions).toHaveLength(1);
  });

  it("drops items with empty or duplicate options", () => {
    const empty = item({ options: ["divagar", "", "dormir", "comer"] });
    const dup = item({ term: "piece of cake", options: ["a", "a", "b", "c"] });
    const questions = buildAiQuizQuestions({ items: [empty, dup], words, seed: SEED });
    expect(questions).toHaveLength(0);
  });

  it("is deterministic for a given seed", () => {
    const args = {
      items: [item(), item({ term: "piece of cake", options: ["muito fácil", "difícil", "caro", "longe"] })],
      words,
      seed: SEED,
    };
    expect(buildAiQuizQuestions(args)).toEqual(buildAiQuizQuestions(args));
  });
});
