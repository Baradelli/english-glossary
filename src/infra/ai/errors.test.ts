import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { mapAiError } from "./errors.js";

describe("mapAiError", () => {
  it("maps APIConnectionError to the offline message", () => {
    const err = new Anthropic.APIConnectionError({ message: "Connection error." });
    expect(mapAiError(err)).toBe(
      "Sem conexão com a internet. As funções de IA precisam de internet; o restante do app funciona normalmente offline.",
    );
  });

  it("maps APIConnectionTimeoutError (a connection-error subclass) to the same offline message", () => {
    const err = new Anthropic.APIConnectionTimeoutError();
    expect(mapAiError(err)).toBe(
      "Sem conexão com a internet. As funções de IA precisam de internet; o restante do app funciona normalmente offline.",
    );
  });

  it("maps AuthenticationError (401) to an invalid-key message", () => {
    const err = new Anthropic.AuthenticationError(
      401,
      undefined,
      "invalid x-api-key",
      new Headers(),
    );
    expect(mapAiError(err)).toBe("Chave de API inválida ou revogada.");
  });

  it("maps PermissionDeniedError (403) to a no-access message", () => {
    const err = new Anthropic.PermissionDeniedError(
      403,
      undefined,
      "no access to this model",
      new Headers(),
    );
    expect(mapAiError(err)).toBe("A chave não tem acesso a este modelo.");
  });

  it("maps NotFoundError (404) to a model-not-found message", () => {
    const err = new Anthropic.NotFoundError(404, undefined, "model not found", new Headers());
    expect(mapAiError(err)).toBe("Modelo não encontrado — verifique o ID do modelo.");
  });

  it("maps RateLimitError (429) to a rate-limit message", () => {
    const err = new Anthropic.RateLimitError(429, undefined, "too many requests", new Headers());
    expect(mapAiError(err)).toBe(
      "Limite de requisições atingido — tente novamente em instantes.",
    );
  });

  it("maps any other APIError to a generic status+message string", () => {
    const err = new Anthropic.InternalServerError(500, undefined, "internal error", new Headers());
    expect(mapAiError(err)).toBe(`Erro da API (status 500): ${err.message}`);
  });

  it("falls back to the message of a plain Error", () => {
    expect(mapAiError(new Error("boom"))).toBe("boom");
  });

  it("falls back to a generic message for non-Error values", () => {
    expect(mapAiError("just a string")).toBe("Erro inesperado.");
    expect(mapAiError({ some: "object" })).toBe("Erro inesperado.");
    expect(mapAiError(undefined)).toBe("Erro inesperado.");
  });
});
