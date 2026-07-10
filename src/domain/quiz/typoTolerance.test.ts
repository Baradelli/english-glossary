import { describe, expect, it } from "vitest";
import {
  damerauLevenshtein,
  isAnswerAcceptable,
  normalizeAnswer,
} from "./typoTolerance.js";

describe("damerauLevenshtein (OSA)", () => {
  it("is 0 for equal strings and the length for empty ones", () => {
    expect(damerauLevenshtein("ramble", "ramble")).toBe(0);
    expect(damerauLevenshtein("", "abc")).toBe(3);
    expect(damerauLevenshtein("abc", "")).toBe(3);
  });

  it("counts substitution, insertion, deletion and transposition as 1", () => {
    expect(damerauLevenshtein("ramble", "rumble")).toBe(1); // substitution
    expect(damerauLevenshtein("ramble", "rambles")).toBe(1); // insertion
    expect(damerauLevenshtein("ramble", "rambe")).toBe(1); // deletion
    expect(damerauLevenshtein("ramble", "rmable")).toBe(1); // transposition
  });

  it("counts two independent edits as 2", () => {
    expect(damerauLevenshtein("ramble", "rumbles")).toBe(2);
  });
});

describe("normalizeAnswer", () => {
  it("trims, lowercases and collapses inner whitespace", () => {
    expect(normalizeAnswer("  Give   UP \t")).toBe("give up");
  });
});

describe("isAnswerAcceptable", () => {
  it("accepts exact and case-insensitive matches with messy spaces", () => {
    expect(isAnswerAcceptable("ramble", "ramble")).toBe(true);
    expect(isAnswerAcceptable("Ramble", "  rAMBLE ")).toBe(true);
    expect(isAnswerAcceptable("give up", "Give   Up")).toBe(true);
  });

  it("accepts one substitution, transposition, insertion or deletion (4+ chars)", () => {
    expect(isAnswerAcceptable("ramble", "rumble")).toBe(true); // 1 swap
    expect(isAnswerAcceptable("ramble", "rmable")).toBe(true); // transposition
    expect(isAnswerAcceptable("ramble", "rambble")).toBe(true); // insertion
    expect(isAnswerAcceptable("ramble", "rambe")).toBe(true); // deletion
  });

  it("rejects distance 2", () => {
    expect(isAnswerAcceptable("ramble", "rumbles")).toBe(false);
    expect(isAnswerAcceptable("ramble", "rmalbe")).toBe(false);
  });

  it("requires an exact match for expected answers shorter than 4 chars", () => {
    expect(isAnswerAcceptable("cat", "cat")).toBe(true);
    expect(isAnswerAcceptable("cat", "cut")).toBe(false); // DL 1, but too short
    expect(isAnswerAcceptable("cat", "cats")).toBe(false);
  });

  it("measures the threshold on the normalized expected length", () => {
    // " cat " normalizes to "cat" (3 chars) → still exact-only.
    expect(isAnswerAcceptable("  cat ", "bat")).toBe(false);
  });
});
