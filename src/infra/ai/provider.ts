import type { AiProvider } from "../../domain/index.js";
import { ApiAiProvider } from "./ApiAiProvider.js";

/**
 * Returns the configured AiProvider, or null in Manual mode (the default).
 * The API adapter is opt-in: it activates only when ANTHROPIC_API_KEY is set.
 */
export function getAiProvider(): AiProvider | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new ApiAiProvider({ apiKey, model: process.env.ANTHROPIC_MODEL });
}
