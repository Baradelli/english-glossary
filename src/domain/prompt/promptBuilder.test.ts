import { describe, expect, it } from "vitest";
import {
  JSON_SCHEMA_INSTRUCTION,
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

describe("JSON_SCHEMA_INSTRUCTION (§6.2 — common closing)", () => {
  it("locks the strict-JSON instruction and every schema key", () => {
    expect(JSON_SCHEMA_INSTRUCTION).toContain("ESTRITAMENTE");
    for (const key of ["score", "items", "term", "correct", "note", "feedback"]) {
      expect(JSON_SCHEMA_INSTRUCTION).toContain(key);
    }
  });
});

describe("buildWeeklyReviewPrompt (Template 1)", () => {
  it("ends with the shared JSON schema instruction", () => {
    expect(buildWeeklyReviewPrompt(words).endsWith(JSON_SCHEMA_INSTRUCTION)).toBe(
      true,
    );
  });

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
  it("ends with the shared JSON schema instruction", () => {
    expect(
      buildVocabularyExamPrompt(words).endsWith(JSON_SCHEMA_INSTRUCTION),
    ).toBe(true);
  });

  it("includes real context sentences when a word has them", () => {
    const prompt = buildVocabularyExamPrompt(words);
    expect(prompt).toContain("Sorry, I tend to ramble when I'm nervous.");
  });

  it("prioritises use-in-context over rote translation", () => {
    const prompt = buildVocabularyExamPrompt(words).toLowerCase();
    expect(prompt).toContain("contexto");
  });

  it("throws when there are no words", () => {
    expect(() => buildVocabularyExamPrompt([])).toThrow();
  });
});

describe("buildSourceComprehensionPrompt (Template 3)", () => {
  const source = { name: "Fireship — TypeScript in 100s" };

  it("ends with the shared JSON schema instruction", () => {
    const prompt = buildSourceComprehensionPrompt({ source, words });
    expect(prompt.endsWith(JSON_SCHEMA_INSTRUCTION)).toBe(true);
  });

  it("names the source", () => {
    const prompt = buildSourceComprehensionPrompt({ source, words });
    expect(prompt).toContain("Fireship — TypeScript in 100s");
  });

  it("embeds the transcript and grounds questions on it when provided", () => {
    const transcript = "TypeScript adds static types to JavaScript.";
    const prompt = buildSourceComprehensionPrompt({
      source,
      words,
      transcript,
    });
    expect(prompt).toContain(transcript);
  });

  it("does not invent a transcript section when none is given", () => {
    const withT = buildSourceComprehensionPrompt({
      source,
      words,
      transcript: "some transcript text",
    });
    const withoutT = buildSourceComprehensionPrompt({ source, words });
    expect(withoutT).not.toContain("some transcript text");
    // The two prompts must differ — the transcript materially changes the body.
    expect(withoutT).not.toBe(withT);
  });

  it("works with no words (content-only comprehension)", () => {
    expect(() =>
      buildSourceComprehensionPrompt({ source, words: [] }),
    ).not.toThrow();
  });
});

describe("purity", () => {
  it("does not mutate the input words", () => {
    const input: PromptWord[] = [
      { term: "ramble", contextSentences: ["one"] },
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    buildWeeklyReviewPrompt(input);
    buildVocabularyExamPrompt(input);
    buildSourceComprehensionPrompt({ source: { name: "x" }, words: input });
    expect(input).toEqual(snapshot);
  });
});
