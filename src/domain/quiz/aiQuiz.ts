/**
 * AiQuiz — the Zod schema for the AI-generated quiz (ADR-009) and a pure
 * parser. Mirrors the ExamResult module's contract style: the prompt
 * (buildQuizGenerationPrompt) asks the AI for exactly this JSON shape, and the
 * quiz starters validate the reply before persisting any question — a reply
 * that fails here is retried once and then surfaces as an error, never as a
 * half-broken exam.
 *
 * The parser never throws and tolerates unknown extra keys (Zod's default
 * strip), for the same reasons as the ExamResult parser.
 */

import { z } from "zod";
import { extractJsonText } from "../shared/json.js";

export const AiQuizItemSchema = z.object({
  term: z.string().min(1, "term não pode ser vazio"),
  prompt: z.string().min(1, "prompt não pode ser vazio"),
  options: z
    .array(z.string())
    .length(4, "options deve ter exatamente 4 alternativas"),
  optionExplanations: z
    .array(
      z
        .string()
        .trim()
        .min(1, "cada explicação de alternativa deve ser preenchida"),
    )
    .length(
      4,
      "optionExplanations deve ter exatamente 4 explicações",
    ),
  correctIndex: z
    .number()
    .int("correctIndex deve ser um inteiro")
    .min(0, "correctIndex deve ser >= 0")
    .max(3, "correctIndex deve ser <= 3"),
  // Kept for parser compatibility; new prompts use optionExplanations.
  explanation: z.string().nullable().default(null),
});

export const AiQuizSchema = z.object({
  items: z.array(AiQuizItemSchema),
});

export type AiQuizItem = z.infer<typeof AiQuizItemSchema>;
export type AiQuiz = z.infer<typeof AiQuizSchema>;

export type ParsedAiQuiz =
  | { readonly ok: true; readonly value: AiQuiz }
  | { readonly ok: false; readonly error: string };

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "(raiz)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * Parses raw AI text into a validated {@link AiQuiz}. Markdown fences and
 * surrounding prose are stripped by the shared JSON extractor.
 *
 * @returns `{ ok: true, value }` when valid, otherwise `{ ok: false, error }`.
 *          Never throws.
 */
export function parseAiQuiz(text: string): ParsedAiQuiz {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `JSON inválido: ${message}` };
  }

  const result = AiQuizSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `Resposta fora do schema: ${formatIssues(result.error)}`,
    };
  }

  return { ok: true, value: result.data };
}
