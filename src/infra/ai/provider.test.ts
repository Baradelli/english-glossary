import { describe, expect, it } from "vitest";
import { createAiProvider } from "./provider.js";

describe("createAiProvider", () => {
  it("returns null when the API key is null", () => {
    expect(createAiProvider({ apiKey: null, model: null })).toBeNull();
  });

  it("returns null when the API key is empty", () => {
    expect(createAiProvider({ apiKey: "", model: null })).toBeNull();
  });

  it("returns an ApiAiProvider instance when a key is present", () => {
    const provider = createAiProvider({ apiKey: "sk-ant-test", model: null });
    expect(provider).not.toBeNull();
    expect(provider?.name).toBe("api");
  });

  it("builds a provider regardless of a custom model being set", () => {
    const provider = createAiProvider({ apiKey: "sk-ant-test", model: "claude-haiku" });
    expect(provider).not.toBeNull();
    expect(provider?.name).toBe("api");
  });
});
