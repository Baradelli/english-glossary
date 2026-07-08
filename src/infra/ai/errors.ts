import Anthropic from "@anthropic-ai/sdk";

/**
 * Central error mapper for the Anthropic SDK. Explicit user requirement: being
 * offline must never look like a broken API key or a bad model — it gets its
 * own message, distinct from genuine API errors. Checks run most-specific to
 * least, since AuthenticationError/PermissionDeniedError/NotFoundError/
 * RateLimitError all extend the generic APIError (and APIConnectionTimeoutError
 * extends APIConnectionError, so timeouts are covered by the first check).
 */
export function mapAiError(err: unknown): string {
  if (err instanceof Anthropic.APIConnectionError) {
    return "Sem conexão com a internet. As funções de IA precisam de internet; o restante do app funciona normalmente offline.";
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return "Chave de API inválida ou revogada.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "A chave não tem acesso a este modelo.";
  }
  if (err instanceof Anthropic.NotFoundError) {
    return "Modelo não encontrado — verifique o ID do modelo.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Limite de requisições atingido — tente novamente em instantes.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Erro da API (status ${err.status}): ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Erro inesperado.";
}
