import { describe, expect, it } from "vitest";
import {
  AI_QUIZ_JSON_SCHEMA_INSTRUCTION,
  DEFINITION_SCHEMA_INSTRUCTION,
  JSON_SCHEMA_INSTRUCTION,
  PRESENT_EXAM_INSTRUCTION,
  buildCorrectionPrompt,
  buildDefineExpressionPrompt,
  buildDefineWordPrompt,
  buildQuizGenerationPrompt,
  buildSourceComprehensionPrompt,
  type PromptWord,
} from "./promptBuilder.js";

const ramble: PromptWord = {
  term: "ramble",
  definitionEn: "to talk at length in a confused way",
  definitionPt: "divagar",
  examples: ["He started to ramble about his childhood."],
  contextSentences: ["Sorry, I tend to ramble when I'm nervous."],
  observations: [
    "Pode soar negativo quando a pessoa fala por tempo demais.",
  ],
};

// §1 decision: flexed forms are distinct entries, never lemmatised.
const rambling: PromptWord = {
  term: "rambling",
  definitionEn: "lengthy and confused",
  definitionPt: "prolixo",
  examples: ["a rambling speech"],
};

const words: PromptWord[] = [ramble, rambling];

// The two-turn flow (§6.2): the question prompt only asks the AI to present an
// exam — it must NOT request the correction JSON. That belongs to turn 2.
describe("question prompts are turn 1 (present the exam, no JSON)", () => {
  const builders = [
    ["comprehension", () =>
      buildSourceComprehensionPrompt({ source: { name: "S" }, words })],
  ] as const;

  it.each(builders)("%s ends with the present-exam instruction", (_n, build) => {
    expect(build().endsWith(PRESENT_EXAM_INSTRUCTION)).toBe(true);
  });

  it.each(builders)("%s does not leak the correction schema", (_n, build) => {
    expect(build()).not.toContain(JSON_SCHEMA_INSTRUCTION);
  });
});

describe("buildSourceComprehensionPrompt (Template 3)", () => {
  const source = { name: "Fireship — TypeScript in 100s" };

  it("names the source", () => {
    expect(buildSourceComprehensionPrompt({ source, words })).toContain(
      "Fireship — TypeScript in 100s",
    );
  });

  it("embeds the transcript when provided", () => {
    const transcript = "TypeScript adds static types to JavaScript.";
    expect(
      buildSourceComprehensionPrompt({ source, words, transcript }),
    ).toContain(transcript);
  });

  it("differs depending on whether a transcript is given", () => {
    const withT = buildSourceComprehensionPrompt({
      source,
      words,
      transcript: "some transcript text",
    });
    const withoutT = buildSourceComprehensionPrompt({ source, words });
    expect(withoutT).not.toContain("some transcript text");
    expect(withoutT).not.toBe(withT);
  });

  it("works with no words (content-only comprehension)", () => {
    expect(() =>
      buildSourceComprehensionPrompt({ source, words: [] }),
    ).not.toThrow();
  });
});

describe("buildQuizGenerationPrompt (AI quiz generation — one-turn JSON)", () => {
  it("asks for one question per term and lists every term", () => {
    const prompt = buildQuizGenerationPrompt(words);
    expect(prompt).toContain("exatamente 2 questões");
    expect(prompt).toContain("ramble");
    expect(prompt).toContain("rambling");
  });

  it("frames the questions as multiple choice", () => {
    const prompt = buildQuizGenerationPrompt(words).toLowerCase();
    expect(prompt).toContain("múltipla escolha");
  });

  it("ends with the strict AiQuiz JSON schema instruction incl. option explanations", () => {
    const prompt = buildQuizGenerationPrompt(words);
    expect(prompt.endsWith(AI_QUIZ_JSON_SCHEMA_INSTRUCTION)).toBe(true);
    for (const key of [
      "items",
      "term",
      "prompt",
      "options",
      "correctIndex",
      "optionExplanations",
    ]) {
      expect(prompt).toContain(`"${key}"`);
    }
  });

  it("requires a short position-independent reason for every alternative", () => {
    const prompt = buildQuizGenerationPrompt(words);
    expect(prompt).toContain("uma justificativa curta para cada alternativa");
    expect(prompt).toContain("não mencione letras, números ou posições");
  });

  it("does not use the two-turn present-exam instruction", () => {
    expect(buildQuizGenerationPrompt(words)).not.toContain(
      PRESENT_EXAM_INSTRUCTION,
    );
  });

  it("throws on empty words", () => {
    expect(() => buildQuizGenerationPrompt([])).toThrow();
  });
});

describe("buildCorrectionPrompt (turn 2 — the only one that asks for JSON)", () => {
  const answers = "1. ramble = divagar (minha resposta)\n2. rambling = ???";

  it("embeds the pasted exam-and-answers", () => {
    expect(buildCorrectionPrompt({ answersText: answers })).toContain(answers);
  });

  it("ends with the strict-JSON schema instruction and all its keys", () => {
    const prompt = buildCorrectionPrompt({ answersText: answers });
    expect(prompt.endsWith(JSON_SCHEMA_INSTRUCTION)).toBe(true);
    for (const key of ["score", "items", "term", "correct", "note", "feedback"]) {
      expect(prompt).toContain(key);
    }
  });

  it("requires non-empty answers text", () => {
    expect(() => buildCorrectionPrompt({ answersText: "   " })).toThrow();
  });
});

describe("buildDefineExpressionPrompt (idiom-aware define)", () => {
  it("throws on an empty term", () => {
    expect(() => buildDefineExpressionPrompt("   ")).toThrow();
  });

  it("includes the expression verbatim", () => {
    expect(buildDefineExpressionPrompt("break a leg")).toContain("break a leg");
  });

  it("frames it as an idiomatic expression (figurative meaning + register)", () => {
    const prompt = buildDefineExpressionPrompt("break a leg").toLowerCase();
    expect(prompt).toContain("expressão");
    expect(prompt).toContain("figurado");
    expect(prompt).toContain("registro");
  });

  it("differs from the plain word prompt for the same term", () => {
    expect(buildDefineExpressionPrompt("piece of cake")).not.toBe(
      buildDefineWordPrompt("piece of cake"),
    );
  });

  it("reuses the same JSON schema instruction (same storage shape)", () => {
    expect(buildDefineExpressionPrompt("piece of cake")).toContain(
      DEFINITION_SCHEMA_INSTRUCTION,
    );
  });

  it("prioritises the meaning in context when a sentence is given", () => {
    const withCtx = buildDefineExpressionPrompt(
      "piece of cake",
      "The exam was a piece of cake.",
    );
    expect(withCtx).toContain("The exam was a piece of cake.");
    expect(withCtx).not.toBe(buildDefineExpressionPrompt("piece of cake"));
  });
});

describe("purity", () => {
  it("does not mutate the input words", () => {
    const input: PromptWord[] = [{ term: "ramble", contextSentences: ["one"] }];
    const snapshot = JSON.parse(JSON.stringify(input));
    buildSourceComprehensionPrompt({ source: { name: "x" }, words: input });
    buildQuizGenerationPrompt(input);
    expect(input).toEqual(snapshot);
  });
});

describe("student observations", () => {
  it("includes accumulated observations in quiz and comprehension prompts", () => {
    expect(buildQuizGenerationPrompt(words)).toContain(
      "Pode soar negativo quando a pessoa fala por tempo demais.",
    );
    expect(
      buildSourceComprehensionPrompt({
        source: { name: "Fireship" },
        words,
      }),
    ).toContain("Pode soar negativo quando a pessoa fala por tempo demais.");
  });
});
