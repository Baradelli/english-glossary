import { describe, expect, it } from "vitest";
import {
  JSON_SCHEMA_INSTRUCTION,
  PRESENT_EXAM_INSTRUCTION,
  buildCorrectionPrompt,
  buildSourceComprehensionPrompt,
  buildVocabularyExamPrompt,
  buildWeeklyReviewPrompt,
  type PromptWord,
} from "./promptBuilder.js";

const ramble: PromptWord = {
  term: "ramble",
  definitionEn: "to talk at length in a confused way",
  definitionPt: "divagar",
  examples: ["He started to ramble about his childhood."],
  contextSentences: ["Sorry, I tend to ramble when I'm nervous."],
};

// §1 decision: flexed forms are distinct entries, never lemmatised.
const rambling: PromptWord = {
  term: "rambling",
  definitionEn: "lengthy and confused",
  definitionPt: "prolixo",
  examples: ["a rambling speech"],
};

const words: PromptWord[] = [ramble, rambling];

// The two-turn flow (§6.2): the question prompts only ask the AI to present an
// exam — they must NOT request the correction JSON. That belongs to turn 2.
describe("question prompts are turn 1 (present the exam, no JSON)", () => {
  const builders = [
    ["weekly", () => buildWeeklyReviewPrompt(words)],
    ["vocabulary", () => buildVocabularyExamPrompt(words)],
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

describe("buildWeeklyReviewPrompt (Template 1)", () => {
  it("lists every word verbatim (no lemmatisation)", () => {
    const prompt = buildWeeklyReviewPrompt(words);
    expect(prompt).toContain("ramble");
    expect(prompt).toContain("rambling");
  });

  it("asks for a mixed exam (translation / fill-in / use-in-context)", () => {
    const prompt = buildWeeklyReviewPrompt(words).toLowerCase();
    expect(prompt).toContain("tradução");
    expect(prompt).toContain("completar");
    expect(prompt).toContain("contexto");
  });

  it("throws when there are no words to review", () => {
    expect(() => buildWeeklyReviewPrompt([])).toThrow();
  });
});

describe("buildVocabularyExamPrompt (Template 2)", () => {
  it("includes real context sentences when a word has them", () => {
    expect(buildVocabularyExamPrompt(words)).toContain(
      "Sorry, I tend to ramble when I'm nervous.",
    );
  });

  it("prioritises use-in-context over rote translation", () => {
    expect(buildVocabularyExamPrompt(words).toLowerCase()).toContain("contexto");
  });

  it("throws when there are no words", () => {
    expect(() => buildVocabularyExamPrompt([])).toThrow();
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

describe("purity", () => {
  it("does not mutate the input words", () => {
    const input: PromptWord[] = [{ term: "ramble", contextSentences: ["one"] }];
    const snapshot = JSON.parse(JSON.stringify(input));
    buildWeeklyReviewPrompt(input);
    buildVocabularyExamPrompt(input);
    buildSourceComprehensionPrompt({ source: { name: "x" }, words: input });
    expect(input).toEqual(snapshot);
  });
});
