import { describe, expect, it } from "vitest";
import {
  getEffectiveAiConfig,
  getSettingsView,
  markOnboardingSeen,
  resetOnboarding,
  saveAiSettings,
  saveTheme,
} from "./settings.js";
import { SETTING_KEYS, type SettingsRepository } from "../domain/index.js";

/** In-memory fake of the SettingsRepository port (same pattern as fakeProvider in define.test.ts). */
function fakeSettingsRepository(initial: Record<string, string> = {}): SettingsRepository {
  const store = new Map(Object.entries(initial));
  return {
    async get(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    async getMany(keys) {
      const result: Record<string, string> = {};
      for (const key of keys) {
        if (store.has(key)) result[key] = store.get(key)!;
      }
      return result;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

const VALID_KEY = "sk-ant-api03-XXXXXXXXXXXXXXXXWXYZ";

describe("getEffectiveAiConfig", () => {
  it("uses the DB value when only the DB has settings", async () => {
    const repo = fakeSettingsRepository({
      [SETTING_KEYS.aiApiKey]: VALID_KEY,
      [SETTING_KEYS.aiModel]: "claude-sonnet-5",
    });
    const config = await getEffectiveAiConfig(repo, {});
    expect(config).toEqual({ apiKey: VALID_KEY, model: "claude-sonnet-5" });
  });

  it("falls back to env when the DB has no settings", async () => {
    const repo = fakeSettingsRepository();
    const config = await getEffectiveAiConfig(repo, {
      apiKey: "env-key",
      model: "env-model",
    });
    expect(config).toEqual({ apiKey: "env-key", model: "env-model" });
  });

  it("prefers the DB over env, independently per field", async () => {
    const repo = fakeSettingsRepository({ [SETTING_KEYS.aiApiKey]: VALID_KEY });
    const config = await getEffectiveAiConfig(repo, {
      apiKey: "env-key",
      model: "env-model",
    });
    expect(config).toEqual({ apiKey: VALID_KEY, model: "env-model" });
  });

  it("returns nulls when neither DB nor env have settings", async () => {
    const repo = fakeSettingsRepository();
    const config = await getEffectiveAiConfig(repo, {});
    expect(config).toEqual({ apiKey: null, model: null });
  });
});

describe("getSettingsView", () => {
  it("reports no API key and a null hint when none is set", async () => {
    const repo = fakeSettingsRepository();
    const view = await getSettingsView(repo);
    expect(view.hasApiKey).toBe(false);
    expect(view.apiKeyHint).toBeNull();
  });

  it("hints the stored key without leaking it", async () => {
    const repo = fakeSettingsRepository({ [SETTING_KEYS.aiApiKey]: VALID_KEY });
    const view = await getSettingsView(repo);
    expect(view.hasApiKey).toBe(true);
    expect(view.apiKeyHint).toBe("sk-ant-…WXYZ");
    expect(view.apiKeyHint).not.toContain(VALID_KEY);
  });

  it("normalises an invalid stored theme to 'system'", async () => {
    const repo = fakeSettingsRepository({ [SETTING_KEYS.theme]: "blue" });
    const view = await getSettingsView(repo);
    expect(view.theme).toBe("system");
  });

  it("normalises a missing theme to 'system'", async () => {
    const repo = fakeSettingsRepository();
    const view = await getSettingsView(repo);
    expect(view.theme).toBe("system");
  });

  it("preserves a valid stored theme", async () => {
    const repo = fakeSettingsRepository({ [SETTING_KEYS.theme]: "dark" });
    const view = await getSettingsView(repo);
    expect(view.theme).toBe("dark");
  });

  it("passes through model and onboardingSeenAt", async () => {
    const repo = fakeSettingsRepository({
      [SETTING_KEYS.aiModel]: "claude-haiku-4-5",
      [SETTING_KEYS.onboardingSeenAt]: "2026-01-01T00:00:00.000Z",
    });
    const view = await getSettingsView(repo);
    expect(view.model).toBe("claude-haiku-4-5");
    expect(view.onboardingSeenAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("reports null model when none is set", async () => {
    const repo = fakeSettingsRepository();
    const view = await getSettingsView(repo);
    expect(view.model).toBeNull();
    expect(view.onboardingSeenAt).toBeNull();
  });
});

describe("saveAiSettings", () => {
  it("rejects a key that doesn't start with sk-ant- and writes nothing", async () => {
    const repo = fakeSettingsRepository();
    const result = await saveAiSettings(repo, { apiKey: "not-a-key", model: "claude-sonnet-5" });
    expect(result).toEqual({ ok: false, error: "A chave deve começar com sk-ant-." });
    expect(await repo.get(SETTING_KEYS.aiApiKey)).toBeNull();
    expect(await repo.get(SETTING_KEYS.aiModel)).toBeNull();
  });

  it("rejects a key that is too short", async () => {
    const repo = fakeSettingsRepository();
    const result = await saveAiSettings(repo, { apiKey: "sk-ant-abc", model: "" });
    expect(result).toEqual({ ok: false, error: "Chave de API muito curta." });
    expect(await repo.get(SETTING_KEYS.aiApiKey)).toBeNull();
  });

  it("keeps the existing key when apiKey is empty", async () => {
    const repo = fakeSettingsRepository({ [SETTING_KEYS.aiApiKey]: VALID_KEY });
    const result = await saveAiSettings(repo, { apiKey: "", model: "" });
    expect(result).toEqual({ ok: true });
    expect(await repo.get(SETTING_KEYS.aiApiKey)).toBe(VALID_KEY);
  });

  it("sets a new key when apiKey is non-empty and valid", async () => {
    const repo = fakeSettingsRepository();
    const result = await saveAiSettings(repo, { apiKey: VALID_KEY, model: "" });
    expect(result).toEqual({ ok: true });
    expect(await repo.get(SETTING_KEYS.aiApiKey)).toBe(VALID_KEY);
  });

  it("clears the key when clearKey is true, ignoring the apiKey field", async () => {
    const repo = fakeSettingsRepository({ [SETTING_KEYS.aiApiKey]: VALID_KEY });
    const result = await saveAiSettings(repo, { apiKey: "", model: "", clearKey: true });
    expect(result).toEqual({ ok: true });
    expect(await repo.get(SETTING_KEYS.aiApiKey)).toBeNull();
  });

  it("rejects an invalid apiKey even when clearKey is true, and leaves the stored key untouched", async () => {
    // Validation runs before the clearKey branch: a bad apiKey value fails
    // the whole call, so clearKey never gets a chance to run. This pins that
    // ordering as intended behavior, not an accident.
    const repo = fakeSettingsRepository({ [SETTING_KEYS.aiApiKey]: VALID_KEY });
    const result = await saveAiSettings(repo, {
      apiKey: "garbage-not-sk-ant",
      model: "",
      clearKey: true,
    });
    expect(result).toEqual({ ok: false, error: "A chave deve começar com sk-ant-." });
    expect(await repo.get(SETTING_KEYS.aiApiKey)).toBe(VALID_KEY);
  });

  it("removes the model key when model is empty (reverts to default)", async () => {
    const repo = fakeSettingsRepository({ [SETTING_KEYS.aiModel]: "claude-sonnet-5" });
    const result = await saveAiSettings(repo, { apiKey: "", model: "" });
    expect(result).toEqual({ ok: true });
    expect(await repo.get(SETTING_KEYS.aiModel)).toBeNull();
  });

  it("accepts a model that is not in SUGGESTED_MODELS (open list)", async () => {
    const repo = fakeSettingsRepository();
    const result = await saveAiSettings(repo, { apiKey: "", model: "some-other-model" });
    expect(result).toEqual({ ok: true });
    expect(await repo.get(SETTING_KEYS.aiModel)).toBe("some-other-model");
  });
});

describe("saveTheme", () => {
  it("saves a valid theme", async () => {
    const repo = fakeSettingsRepository();
    const result = await saveTheme(repo, "dark");
    expect(result).toEqual({ ok: true });
    expect(await repo.get(SETTING_KEYS.theme)).toBe("dark");
  });

  it("rejects an invalid theme", async () => {
    const repo = fakeSettingsRepository();
    const result = await saveTheme(repo, "blue");
    expect(result.ok).toBe(false);
    expect(await repo.get(SETTING_KEYS.theme)).toBeNull();
  });
});

describe("resetOnboarding", () => {
  it("removes the onboardingSeenAt key", async () => {
    const repo = fakeSettingsRepository({
      [SETTING_KEYS.onboardingSeenAt]: "2026-01-01T00:00:00.000Z",
    });
    await resetOnboarding(repo);
    expect(await repo.get(SETTING_KEYS.onboardingSeenAt)).toBeNull();
  });

  it("is idempotent when there is nothing to remove", async () => {
    const repo = fakeSettingsRepository();
    await expect(resetOnboarding(repo)).resolves.toBeUndefined();
    expect(await repo.get(SETTING_KEYS.onboardingSeenAt)).toBeNull();
  });
});

describe("markOnboardingSeen", () => {
  it("stores a valid ISO timestamp", async () => {
    const repo = fakeSettingsRepository();
    await markOnboardingSeen(repo);
    const stored = await repo.get(SETTING_KEYS.onboardingSeenAt);
    expect(stored).not.toBeNull();
    expect(new Date(stored!).toISOString()).toBe(stored);
  });

  it("overwrites a previously stored timestamp", async () => {
    const repo = fakeSettingsRepository({
      [SETTING_KEYS.onboardingSeenAt]: "2020-01-01T00:00:00.000Z",
    });
    await markOnboardingSeen(repo);
    const stored = await repo.get(SETTING_KEYS.onboardingSeenAt);
    expect(stored).not.toBe("2020-01-01T00:00:00.000Z");
  });
});
