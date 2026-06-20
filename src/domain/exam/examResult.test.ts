import { describe, expect, it } from "vitest";
import {
  ExamResultSchema,
  parseExamResult,
  type ExamResult,
} from "./examResult.js";

const valid: ExamResult = {
  score: 80,
  items: [
    { term: "ramble", correct: true, note: "usou bem em contexto" },
    { term: "rambling", correct: false, note: "confundiu com o verbo" },
  ],
  feedback: "Bom desempenho geral.",
};

function json(value: unknown): string {
  return JSON.stringify(value);
}

describe("ExamResultSchema", () => {
  it("accepts a well-formed correction object", () => {
    expect(ExamResultSchema.safeParse(valid).success).toBe(true);
  });
});

describe("parseExamResult — happy path", () => {
  it("returns the typed result for valid JSON", () => {
    const result = parseExamResult(json(valid));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(valid);
    }
  });

  it("tolerates the AI adding extra unknown keys (manual-paste robustness)", () => {
    const withExtra = { ...valid, model: "claude", _debug: 123 };
    const result = parseExamResult(json(withExtra));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(valid); // extras stripped
    }
  });
});

describe("parseExamResult — malformed JSON", () => {
  it("rejects text that is not JSON, with a clear message", () => {
    const result = parseExamResult("Claro! Aqui está sua correção: {score: 80");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("JSON inválido");
    }
  });

  it("never throws — even on garbage input", () => {
    expect(() => parseExamResult("")).not.toThrow();
    expect(() => parseExamResult("<<<>>>")).not.toThrow();
  });
});

describe("parseExamResult — schema violations are rejected clearly", () => {
  it("rejects a missing 'score' and names the field", () => {
    const { score: _omit, ...rest } = valid;
    const result = parseExamResult(json(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("score");
  });

  it("rejects score above 100", () => {
    const result = parseExamResult(json({ ...valid, score: 120 }));
    expect(result.ok).toBe(false);
  });

  it("rejects score below 0", () => {
    const result = parseExamResult(json({ ...valid, score: -5 }));
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer score", () => {
    const result = parseExamResult(json({ ...valid, score: 80.5 }));
    expect(result.ok).toBe(false);
  });

  it("rejects an item whose 'correct' is not a boolean", () => {
    const broken = {
      ...valid,
      items: [{ term: "ramble", correct: "yes", note: "x" }],
    };
    const result = parseExamResult(json(broken));
    expect(result.ok).toBe(false);
  });

  it("rejects an item with an empty term", () => {
    const broken = {
      ...valid,
      items: [{ term: "", correct: true, note: "x" }],
    };
    const result = parseExamResult(json(broken));
    expect(result.ok).toBe(false);
  });

  it("rejects a bare JSON value (not an object) and points at the root", () => {
    const result = parseExamResult("42");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("(raiz)");
  });

  it("rejects a missing 'feedback'", () => {
    const { feedback: _omit, ...rest } = valid;
    const result = parseExamResult(json(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("feedback");
  });
});
