/**
 * Settings domain — the key-value keys, types and validation shared by the
 * Configurações screen and the AI provider. Pure: only constants and Zod
 * schemas, no I/O (persistence goes through SettingsRepository, in ports).
 */

import { z } from "zod";

/** Keys stored in the Setting key-value table (§ SettingsRepository). */
export const SETTING_KEYS = {
  aiApiKey: "ai.apiKey",
  aiModel: "ai.model",
  theme: "theme",
  onboardingSeenAt: "onboardingSeenAt",
} as const;

export type Theme = "light" | "dark" | "system";

/**
 * Open list of model ids offered to the user as suggestions in the
 * Configurações screen — not an enum: any non-empty string is a valid model.
 */
export const SUGGESTED_MODELS = [
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-haiku-4-5",
] as const;

export const ThemeSchema = z.enum(["light", "dark", "system"], {
  message: "Tema inválido.",
});

/**
 * Validates the AI settings form. An empty `apiKey` means "keep the existing
 * key" and an empty `model` means "use the default model" — both are valid
 * inputs here; the application layer decides what to do with the emptiness.
 * A non-empty `apiKey` must look like a real Anthropic key; `model` is an
 * open string (the suggested list is not a closed enum).
 */
export const AiSettingsSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") return;
      if (!value.startsWith("sk-ant-")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A chave deve começar com sk-ant-.",
        });
        return;
      }
      if (value.length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Chave de API muito curta.",
        });
      }
    }),
  model: z.string().trim(),
});
