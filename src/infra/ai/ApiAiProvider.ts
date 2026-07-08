import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider } from "../../domain/index.js";

/** Default model. ADR-001's cost note assumed Sonnet; override via ANTHROPIC_MODEL. */
export const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * ApiAdapter (ADR-001) — implements the AiProvider port by calling the Claude
 * Messages API through the official SDK. Opt-in: only instantiated when an API
 * key is configured (see {@link createAiProvider} in `src/infra/ai/provider.ts`,
 * composed with the effective config by `src/server/ai.ts`).
 */
export class ApiAiProvider implements AiProvider {
  readonly name = "api";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts: { apiKey: string; model?: string | undefined }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model && opts.model.length > 0 ? opts.model : DEFAULT_MODEL;
  }

  async complete(prompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    return message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
  }
}
