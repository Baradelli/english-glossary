import type { AiProvider } from "../../domain/index.js";
import { ApiAiProvider } from "./ApiAiProvider.js";

/**
 * Pure factory: builds the AiProvider from an already-resolved config, or
 * returns null in Manual mode (the default). Deciding *where* the config
 * comes from (settings store, env fallback) is the server layer's job — see
 * `src/server/ai.ts` — so this stays a plain, network-free function that unit
 * tests can call directly.
 */
export function createAiProvider(config: {
  apiKey: string | null;
  model: string | null;
}): AiProvider | null {
  if (!config.apiKey) return null;
  return new ApiAiProvider({ apiKey: config.apiKey, model: config.model ?? undefined });
}
