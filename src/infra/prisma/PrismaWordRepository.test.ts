import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import { PrismaSourceRepository } from "./PrismaSourceRepository.js";
import { PrismaSourceTypeRepository } from "./PrismaSourceTypeRepository.js";
import { PrismaWordRepository } from "./PrismaWordRepository.js";
import type { NewWord } from "../../domain/ports/repositories.js";

const prisma = getTestPrisma();
const repo = new PrismaWordRepository(prisma);
const sources = new PrismaSourceRepository(prisma);
const types = new PrismaSourceTypeRepository(prisma);

const NOW = new Date("2026-06-19T00:00:00.000Z");

function newWord(overrides: Partial<NewWord> = {}): NewWord {
  return {
    term: "ramble",
    definitionEn: "to talk at length in a confused way",
    definitionPt: "divagar",
    examples: ["He started to ramble.", "I tend to ramble."],
    nextReview: NOW,
    ...overrides,
  };
}

async function aSourceId(): Promise<string> {
  const sourceTypeId = (await types.create("Vídeo")).id;
  return (await sources.create({ name: "S", sourceTypeId })).id;
}

beforeEach(resetDb);

describe("PrismaWordRepository — create", () => {
  it("persists a word with its authorial examples (JSON round-trip)", async () => {
    const word = await repo.create(newWord());
    expect(word.id).toBeTruthy();
    expect(word.examples).toEqual(["He started to ramble.", "I tend to ramble."]);
    expect(word.observations).toEqual([]);
  });

  it("starts a new word at the initial SRS state (ease 2.5, interval 0, reps 0)", async () => {
    const word = await repo.create(newWord());
    expect(word.easeFactor).toBe(2.5);
    expect(word.intervalDays).toBe(0);
    expect(word.repetitions).toBe(0);
    expect(word.nextReview.toISOString()).toBe(NOW.toISOString());
  });

  it("honours an injected createdAt", async () => {
    const createdAt = new Date("2020-01-02T03:04:05.000Z");
    const word = await repo.create(newWord({ createdAt }));
    expect(word.createdAt.toISOString()).toBe(createdAt.toISOString());
  });
});

describe("PrismaWordRepository — findByTerm", () => {
  it("matches case-insensitively", async () => {
    await repo.create(newWord({ term: "Ramble" }));
    const found = await repo.findByTerm("ramble");
    expect(found?.term).toBe("Ramble");
  });

  it("treats flexed forms as distinct entries (no lemmatisation)", async () => {
    await repo.create(newWord({ term: "ramble" }));
    await repo.create(newWord({ term: "rambling" }));
    expect((await repo.findByTerm("ramble"))?.term).toBe("ramble");
    expect((await repo.findByTerm("rambling"))?.term).toBe("rambling");
  });

  it("rejects a case-insensitive duplicate term", async () => {
    await repo.create(newWord({ term: "ramble" }));
    await expect(repo.create(newWord({ term: "Ramble" }))).rejects.toThrow();
  });

  it("returns null for an unknown term", async () => {
    expect(await repo.findByTerm("nope")).toBeNull();
  });

  it("returns null for an unknown id", async () => {
    expect(await repo.findById("missing")).toBeNull();
  });
});

describe("PrismaWordRepository — updateSrs", () => {
  it("writes back the new SRS fields and next review date", async () => {
    const word = await repo.create(newWord());
    const updated = await repo.updateSrs(word.id, {
      easeFactor: 2.6,
      intervalDays: 6,
      repetitions: 2,
      nextReview: new Date("2026-06-25T00:00:00.000Z"),
    });
    expect(updated.easeFactor).toBeCloseTo(2.6, 10);
    expect(updated.intervalDays).toBe(6);
    expect(updated.repetitions).toBe(2);
    expect(updated.nextReview.toISOString()).toBe("2026-06-25T00:00:00.000Z");

    const reloaded = await repo.findById(word.id);
    expect(reloaded?.intervalDays).toBe(6);
  });
});

describe("PrismaWordRepository — listAll", () => {
  it("returns every word ordered by term", async () => {
    await repo.create(newWord({ term: "ramble" }));
    await repo.create(newWord({ term: "abate" }));
    expect((await repo.listAll()).map((w) => w.term)).toEqual([
      "abate",
      "ramble",
    ]);
  });
});

describe("PrismaWordRepository — createWithFirstSighting", () => {
  it("creates the word and its first sighting atomically", async () => {
    const sourceId = await aSourceId();
    const { word, sighting } = await repo.createWithFirstSighting(newWord(), {
      sourceId,
      seenAt: NOW,
      contextSentence: "Sorry, I tend to ramble.",
    });
    expect(word.id).toBeTruthy();
    expect(sighting.wordId).toBe(word.id);
    expect(sighting.isFirstEncounter).toBe(true);
    expect(sighting.contextSentence).toBe("Sorry, I tend to ramble.");

    // Both rows are actually persisted.
    expect(await repo.findById(word.id)).not.toBeNull();
  });

  it("rolls back the word if the sighting cannot be created", async () => {
    await expect(
      repo.createWithFirstSighting(newWord(), {
        sourceId: "ghost-source",
        seenAt: NOW,
      }),
    ).rejects.toThrow();
    // The word must not be left behind.
    expect(await repo.findByTerm("ramble")).toBeNull();
  });
});

describe("PrismaWordRepository — update", () => {
  it("edits definitions and examples without touching term or SRS", async () => {
    const word = await repo.create(newWord({ term: "ramble" }));
    const updated = await repo.update(word.id, {
      definitionEn: "new EN",
      definitionPt: "novo PT",
      examples: ["a", "b"],
    });
    expect(updated.term).toBe("ramble"); // identity unchanged
    expect(updated.definitionEn).toBe("new EN");
    expect(updated.definitionPt).toBe("novo PT");
    expect(updated.examples).toEqual(["a", "b"]);
    expect(updated.repetitions).toBe(word.repetitions); // SRS untouched
    expect(updated.nextReview.toISOString()).toBe(word.nextReview.toISOString());
  });
});

describe("PrismaWordRepository — appendObservation", () => {
  it("appends observations in order without changing definitions or SRS", async () => {
    const word = await repo.create(newWord({ kind: "expressao" }));

    await repo.appendObservation(word.id, "Usado em contextos informais.");
    const updated = await repo.appendObservation(
      word.id,
      "Pode soar negativo quando a fala é longa.",
    );

    expect(updated.observations).toEqual([
      "Usado em contextos informais.",
      "Pode soar negativo quando a fala é longa.",
    ]);
    expect(updated.definitionEn).toBe(word.definitionEn);
    expect(updated.repetitions).toBe(word.repetitions);
    expect((await repo.findById(word.id))?.observations).toEqual(
      updated.observations,
    );
  });
});
