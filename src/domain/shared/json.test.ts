import { describe, expect, it } from "vitest";
import { extractJsonText } from "./json.js";

describe("extractJsonText", () => {
  it("returns bare JSON unchanged", () => {
    expect(extractJsonText('{"a":1}')).toBe('{"a":1}');
  });

  it("unwraps a ```json fenced block (the Haiku/Claude default)", () => {
    const raw = '```json\n{\n  "definitionEn": "x"\n}\n```';
    expect(JSON.parse(extractJsonText(raw))).toEqual({ definitionEn: "x" });
  });

  it("unwraps a plain ``` fence", () => {
    expect(extractJsonText('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("slices JSON out of surrounding prose", () => {
    const raw = 'Claro! Aqui está: {"a":1} — espero ajudar.';
    expect(JSON.parse(extractJsonText(raw))).toEqual({ a: 1 });
  });

  it("leaves non-JSON text alone (parser then reports the error)", () => {
    expect(extractJsonText("desculpe, não sei")).toBe("desculpe, não sei");
  });
});
