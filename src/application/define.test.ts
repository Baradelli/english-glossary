import { describe, expect, it } from "vitest";
import { defineWord } from "./define.js";
import type { AiProvider } from "../domain/index.js";

function fakeProvider(response: string): AiProvider {
  return { name: "fake", complete: async () => response };
}

describe("defineWord", () => {
  it("returns the EN/PT definitions parsed from the provider's JSON", async () => {
    const provider = fakeProvider(
      JSON.stringify({ definitionEn: "to talk at length", definitionPt: "divagar" }),
    );
    const def = await defineWord(provider, "ramble");
    expect(def.definitionEn).toBe("to talk at length");
    expect(def.definitionPt).toBe("divagar");
  });

  it("throws a clear error when the provider returns off-schema text", async () => {
    await expect(
      defineWord(fakeProvider("desculpe, não sei"), "ramble"),
    ).rejects.toThrow();
  });
});
