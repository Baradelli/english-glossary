/**
 * ExamResult — the single Zod schema for the AI correction JSON (§6.2) and a
 * pure parser/validator. This is the contract shared between the prompt (which
 * asks the AI for exactly this shape) and the submit-result flow (which
 * validates what comes back before touching the database).
 *
 * The parser never throws: it returns a discriminated result so callers can
 * surface a clear validation error instead of corrupting data (§10 — the
 * highest-attention risk of v1 is malformed AI JSON).
 *
 * Unknown extra keys are tolerated (Zod's default strip): the AI commonly
 * decorates its reply, and rejecting an otherwise-valid correction over a
 * harmless extra field would be needlessly fragile. Required fields, types and
 * ranges are validated strictly.
 */

import { z } from "zod";
import { extractJsonText } from "../shared/json.js";

export const ExamResultItemSchema = z.object({
  term: z.string().min(1, "term não pode ser vazio"),
  correct: z.boolean(),
  note: z.string(),
});

export const ExamResultSchema = z.object({
  score: z
    .number()
    .int("score deve ser um inteiro")
    .min(0, "score deve ser >= 0")
    .max(100, "score deve ser <= 100"),
  items: z.array(ExamResultItemSchema),
  feedback: z.string(),
});

export type ExamResultItem = z.infer<typeof ExamResultItemSchema>;
export type ExamResult = z.infer<typeof ExamResultSchema>;

export type ParsedExamResult =
  | { readonly ok: true; readonly value: ExamResult }
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
 * Parses raw text into a validated {@link ExamResult}.
 *
 * @param text the JSON string pasted back from the AI
 * @returns `{ ok: true, value }` when valid, otherwise `{ ok: false, error }`
 *          with a human-readable explanation. Never throws.
 */
export function parseExamResult(text: string): ParsedExamResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `JSON inválido: ${message}` };
  }

  const result = ExamResultSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `Resposta fora do schema: ${formatIssues(result.error)}`,
    };
  }

  return { ok: true, value: result.data };
}
