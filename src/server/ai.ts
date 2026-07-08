/**
 * Server-layer composition for the AI provider. Resolves the effective config
 * (settings store first, env as fallback — see {@link getEffectiveAiConfig})
 * on every call and feeds the pure {@link createAiProvider} factory. No
 * instance caching: reading fresh each time is what lets the future Settings
 * screen take effect immediately, without a restart.
 */

import { getEffectiveAiConfig } from "../application/index.js";
import type { AiProvider } from "../domain/index.js";
import { createAiProvider } from "../infra/ai/provider.js";
import { repos } from "./container.js";

export async function getAiProvider(): Promise<AiProvider | null> {
  const config = await getEffectiveAiConfig(repos.settings, {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL,
  });
  return createAiProvider(config);
}
