import { describe, expect, it } from "vitest";
import type { Word as PrismaWord } from "@prisma/client";
import { toWord } from "./mappers.js";

const baseRow: PrismaWord = {
  id: "w1",
  term: "ramble",
  termKey: "ramble",
  kind: "palavra",
  definitionEn: "x",
  definitionPt: "y",
  examples: JSON.stringify(["a", "b"]),
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
  nextReview: new Date("2026-06-19T00:00:00.000Z"),
  createdAt: new Date("2026-06-19T00:00:00.000Z"),
};

describe("toWord — examples decoding", () => {
  it("decodes the JSON-encoded examples column into a string array", () => {
    expect(toWord(baseRow).examples).toEqual(["a", "b"]);
  });

  it("throws on a corrupt examples column (not a JSON string array)", () => {
    expect(() => toWord({ ...baseRow, examples: "{}" })).toThrow();
    expect(() => toWord({ ...baseRow, examples: "[1,2]" })).toThrow();
  });
});

describe("toWord — kind", () => {
  it("carries the kind discriminator through", () => {
    expect(toWord(baseRow).kind).toBe("palavra");
    expect(toWord({ ...baseRow, kind: "expressao" }).kind).toBe("expressao");
  });
});
