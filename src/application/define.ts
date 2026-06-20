/**
 * Generate a word's English + Portuguese definitions via the AiProvider
 * (ADR-001). Builds the define prompt, asks the provider, and validates the
 * reply against the WordDefinition schema — throwing a clear error if the AI
 * returns anything off-schema, so the caller never fills the form with garbage.
 */

import {
  buildDefineWordPrompt,
  parseWordDefinition,
  type AiProvider,
  type WordDefinition,
} from "../domain/index.js";

export async function defineWord(
  provider: AiProvider,
  term: string,
  contextSentence?: string,
): Promise<WordDefinition> {
  const text = await provider.complete(
    buildDefineWordPrompt(term, contextSentence),
  );
  const parsed = parseWordDefinition(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}
