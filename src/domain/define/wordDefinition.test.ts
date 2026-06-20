import { describe, expect, it } from "vitest";
import { parseWordDefinition } from "./wordDefinition.js";
import { buildDefineWordPrompt } from "../prompt/promptBuilder.js";

describe("buildDefineWordPrompt", () => {
  it("names the term and asks for the EN/PT JSON schema", () => {
    const prompt = buildDefineWordPrompt("ramble");
    expect(prompt).toContain("ramble");
    expect(prompt).toContain("ESTRITAMENTE");
    expect(prompt).toContain("definitionEn");
    expect(prompt).toContain("definitionPt");
  });

  it("asks for the general meaning and how the word is used", () => {
    const prompt = buildDefineWordPrompt("ramble").toLowerCase();
    expect(prompt).toContain("geral");
    expect(prompt).toContain("usada");
  });

  it("embeds the context sentence and prioritises the meaning in it", () => {
    const prompt = buildDefineWordPrompt("ramble", "He likes to ramble on.");
    expect(prompt).toContain("He likes to ramble on.");
    expect(prompt.toLowerCase()).toContain("neste contexto");
  });

  it("works without a context sentence", () => {
    expect(buildDefineWordPrompt("ramble", "  ")).toContain("ramble");
  });

  it("throws on an empty term", () => {
    expect(() => buildDefineWordPrompt("   ")).toThrow();
  });
});

describe("parseWordDefinition", () => {
  it("accepts a well-formed definition", () => {
    const result = parseWordDefinition(
      JSON.stringify({ definitionEn: "to talk at length", definitionPt: "divagar" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.definitionPt).toBe("divagar");
    }
  });

  it("accepts JSON wrapped in a markdown code fence (Haiku/Claude default)", () => {
    const raw =
      '```json\n{ "definitionEn": "to talk at length", "definitionPt": "divagar" }\n```';
    const result = parseWordDefinition(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.definitionEn).toBe("to talk at length");
  });

  it("rejects non-JSON text with a clear message", () => {
    const result = parseWordDefinition("Claro! Aqui está: ...");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("JSON inválido");
  });

  it("rejects a missing field", () => {
    const result = parseWordDefinition(JSON.stringify({ definitionEn: "x" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("definitionpt");
  });

  it("rejects an empty definition", () => {
    const result = parseWordDefinition(
      JSON.stringify({ definitionEn: "", definitionPt: "y" }),
    );
    expect(result.ok).toBe(false);
  });
});
