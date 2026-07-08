import Anthropic from "@anthropic-ai/sdk";
import { mapAiError } from "./errors.js";

/**
 * Cheap connectivity check for the Settings screen's "test connection"
 * button: a 1-token request that validates both the API key and the model ID
 * without the cost of a real completion. No retries — a stale network blip
 * should surface immediately rather than after the SDK's default backoff.
 */
export async function testAiConnection(config: {
  apiKey: string;
  model: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = new Anthropic({ apiKey: config.apiKey, timeout: 15_000, maxRetries: 0 });
  try {
    await client.messages.create({
      model: config.model,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAiError(err) };
  }
}
