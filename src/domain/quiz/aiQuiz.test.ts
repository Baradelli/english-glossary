import { describe, expect, it } from "vitest";
import { parseAiQuiz } from "./aiQuiz.js";

const validItem = {
  term: "ramble",
  prompt: 'Em qual frase "ramble" é usado corretamente?',
  options: ["frase A", "frase B", "frase C", "frase D"],
  correctIndex: 2,
};

describe("parseAiQuiz", () => {
  it("accepts a valid payload", () => {
    const result = parseAiQuiz(JSON.stringify({ items: [validItem] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0]?.correctIndex).toBe(2);
    }
  });

  it("accepts JSON wrapped in a markdown fence", () => {
    const fenced = `\`\`\`json\n${JSON.stringify({ items: [validItem] })}\n\`\`\``;
    expect(parseAiQuiz(fenced).ok).toBe(true);
  });

  it("accepts JSON surrounded by prose (no fence)", () => {
    const text = `Aqui estão as questões:\n${JSON.stringify({ items: [validItem] })}\nBom estudo!`;
    expect(parseAiQuiz(text).ok).toBe(true);
  });

  it("tolerates unknown extra keys (Zod strip)", () => {
    const decorated = { items: [{ ...validItem, difficulty: "hard" }], meta: 1 };
    const result = parseAiQuiz(JSON.stringify(decorated));
    expect(result.ok).toBe(true);
  });

  it("defaults a missing explanation to null and keeps a provided one", () => {
    const without = parseAiQuiz(JSON.stringify({ items: [validItem] }));
    expect(without.ok).toBe(true);
    if (without.ok) expect(without.value.items[0]?.explanation).toBeNull();

    const withExpl = parseAiQuiz(
      JSON.stringify({ items: [{ ...validItem, explanation: "porque X" }] }),
    );
    expect(withExpl.ok).toBe(true);
    if (withExpl.ok) expect(withExpl.value.items[0]?.explanation).toBe("porque X");
  });

  it("rejects options with a length other than 4", () => {
    const three = { items: [{ ...validItem, options: ["a", "b", "c"] }] };
    const five = { items: [{ ...validItem, options: ["a", "b", "c", "d", "e"] }] };
    expect(parseAiQuiz(JSON.stringify(three)).ok).toBe(false);
    expect(parseAiQuiz(JSON.stringify(five)).ok).toBe(false);
  });

  it("rejects a correctIndex outside 0..3 or non-integer", () => {
    for (const correctIndex of [-1, 4, 1.5]) {
      const payload = { items: [{ ...validItem, correctIndex }] };
      const result = parseAiQuiz(JSON.stringify(payload));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("correctIndex");
    }
  });

  it("rejects empty term or prompt", () => {
    expect(
      parseAiQuiz(JSON.stringify({ items: [{ ...validItem, term: "" }] })).ok,
    ).toBe(false);
    expect(
      parseAiQuiz(JSON.stringify({ items: [{ ...validItem, prompt: "" }] })).ok,
    ).toBe(false);
  });

  it("never throws on garbage input", () => {
    for (const garbage of ["", "not json at all", "{broken", "[1,2,3]"]) {
      const result = parseAiQuiz(garbage);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    }
  });
});
