/**
 * WordDefinition — the JSON contract for an AI-generated definition of a term
 * (English + Portuguese), with a non-throwing parser. Same shape/role as the
 * ExamResult module: one Zod schema validates whatever the AI returns, whether
 * via the API adapter or pasted back manually.
 */

import { z } from "zod";
import { extractJsonText } from "../shared/json.js";

export const WordDefinitionSchema = z.object({
  definitionEn: z.string().min(1, "definitionEn não pode ser vazio"),
  definitionPt: z.string().min(1, "definitionPt não pode ser vazio"),
  /**
   * Example sentences (English) the AI is asked to supply — at least 3, spanning
   * the word's senses. Defaulted to [] so a reply that omits them still parses
   * (the definitions are too valuable to discard over a missing examples list).
   */
  examples: z.array(z.string().min(1)).default([]),
});

export type WordDefinition = z.infer<typeof WordDefinitionSchema>;

export type ParsedWordDefinition =
  | { readonly ok: true; readonly value: WordDefinition }
  | { readonly ok: false; readonly error: string };

export function parseWordDefinition(text: string): ParsedWordDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `JSON inválido: ${message}` };
  }

  const result = WordDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `Resposta fora do schema: ${details}` };
  }
  return { ok: true, value: result.data };
}
