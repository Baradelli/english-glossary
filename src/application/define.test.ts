import { describe, expect, it } from "vitest";
import { defineWord } from "./define.js";
import type { AiProvider } from "../domain/index.js";

function fakeProvider(response: string): AiProvider {
  return { name: "fake", complete: async () => response };
}

/** A provider that records the prompt it was asked to complete. */
function recordingProvider(response: string): {
  provider: AiProvider;
  promptOf: () => string;
} {
  let seen = "";
  return {
    provider: {
      name: "recording",
      complete: async (prompt) => {
        seen = prompt;
        return response;
      },
    },
    promptOf: () => seen,
  };
}

const VALID = JSON.stringify({ definitionEn: "x", definitionPt: "y" });

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

  it("uses the plain word prompt by default", async () => {
    const { provider, promptOf } = recordingProvider(VALID);
    await defineWord(provider, "ramble");
    expect(promptOf()).toContain("dicionário bilíngue");
  });

  it("uses the idiom-aware prompt when kind is 'expressao'", async () => {
    const { provider, promptOf } = recordingProvider(VALID);
    await defineWord(provider, "break a leg", undefined, "expressao");
    expect(promptOf().toLowerCase()).toContain("expressões idiomáticas");
    expect(promptOf().toLowerCase()).toContain("figurado");
  });
});
