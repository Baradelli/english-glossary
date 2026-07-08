/**
 * Settings use cases — the Configurações screen and the AI provider both read
 * and write through here, never touching SettingsRepository directly. Keeps
 * the "DB overrides env" precedence and the API-key masking logic in one
 * place instead of scattered across server actions and the provider factory.
 */

import {
  AiSettingsSchema,
  SETTING_KEYS,
  ThemeSchema,
  type SettingsRepository,
  type Theme,
} from "../domain/index.js";

export interface SettingsView {
  hasApiKey: boolean;
  /** "sk-ant-…" + last 4 characters of the stored key; null when there is no key. */
  apiKeyHint: string | null;
  /** null means the default model is in use. */
  model: string | null;
  theme: Theme;
  /** ISO timestamp, or null when onboarding hasn't been seen yet. */
  onboardingSeenAt: string | null;
}

function apiKeyHint(apiKey: string): string {
  return `sk-ant-…${apiKey.slice(-4)}`;
}

export async function getSettingsView(repo: SettingsRepository): Promise<SettingsView> {
  const values = await repo.getMany([
    SETTING_KEYS.aiApiKey,
    SETTING_KEYS.aiModel,
    SETTING_KEYS.theme,
    SETTING_KEYS.onboardingSeenAt,
  ]);

  const apiKey = values[SETTING_KEYS.aiApiKey];
  const themeResult = ThemeSchema.safeParse(values[SETTING_KEYS.theme]);

  return {
    hasApiKey: Boolean(apiKey),
    apiKeyHint: apiKey ? apiKeyHint(apiKey) : null,
    model: values[SETTING_KEYS.aiModel] ?? null,
    theme: themeResult.success ? themeResult.data : "system",
    onboardingSeenAt: values[SETTING_KEYS.onboardingSeenAt] ?? null,
  };
}

/**
 * Validates and applies the AI settings form. Nothing is written unless the
 * whole input passes {@link AiSettingsSchema} — a bad key must never
 * partially clobber a good model, or vice versa.
 */
export async function saveAiSettings(
  repo: SettingsRepository,
  input: { apiKey: string; model: string; clearKey?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = AiSettingsSchema.safeParse({ apiKey: input.apiKey, model: input.model });
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "Entrada inválida." };
  }
  const { apiKey, model } = result.data;

  if (input.clearKey) {
    await repo.delete(SETTING_KEYS.aiApiKey);
  } else if (apiKey !== "") {
    await repo.set(SETTING_KEYS.aiApiKey, apiKey);
  } // apiKey === "" and no clearKey: keep the existing key untouched

  if (model === "") {
    await repo.delete(SETTING_KEYS.aiModel);
  } else {
    await repo.set(SETTING_KEYS.aiModel, model);
  }

  return { ok: true };
}

/** Precedence: a value stored in the DB wins; env is only a fallback. */
export async function getEffectiveAiConfig(
  repo: SettingsRepository,
  env: { apiKey?: string | undefined; model?: string | undefined },
): Promise<{ apiKey: string | null; model: string | null }> {
  const values = await repo.getMany([SETTING_KEYS.aiApiKey, SETTING_KEYS.aiModel]);
  return {
    apiKey: values[SETTING_KEYS.aiApiKey] ?? env.apiKey ?? null,
    model: values[SETTING_KEYS.aiModel] ?? env.model ?? null,
  };
}

export async function saveTheme(
  repo: SettingsRepository,
  theme: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = ThemeSchema.safeParse(theme);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "Tema inválido." };
  }
  await repo.set(SETTING_KEYS.theme, result.data);
  return { ok: true };
}

export async function resetOnboarding(repo: SettingsRepository): Promise<void> {
  await repo.delete(SETTING_KEYS.onboardingSeenAt);
}

/** Records that the user has seen (or dismissed) the onboarding tour. */
export async function markOnboardingSeen(repo: SettingsRepository): Promise<void> {
  await repo.set(SETTING_KEYS.onboardingSeenAt, new Date().toISOString());
}
