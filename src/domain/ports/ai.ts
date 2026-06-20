/**
 * AiProvider port (ADR-001). The domain depends only on this interface; the
 * Manual flow needs no provider (the UI mediates copy-paste), while the opt-in
 * ApiAdapter implements it by calling the Claude API. The same Zod ExamResult
 * schema validates whatever a provider returns, so swapping adapters never
 * touches the domain.
 */
export interface AiProvider {
  /** Identifies the adapter (e.g. "api"); handy for diagnostics/UI. */
  readonly name: string;
  /** Sends a prompt to the model and returns its text response. */
  complete(prompt: string): Promise<string>;
}
