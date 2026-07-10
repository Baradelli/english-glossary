import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import { PrismaSourceRepository } from "./PrismaSourceRepository.js";
import { PrismaSourceTypeRepository } from "./PrismaSourceTypeRepository.js";
import { PrismaWordRepository } from "./PrismaWordRepository.js";
import { PrismaWordSightingRepository } from "./PrismaWordSightingRepository.js";

const prisma = getTestPrisma();
const repo = new PrismaWordSightingRepository(prisma);
const words = new PrismaWordRepository(prisma);
const sources = new PrismaSourceRepository(prisma);
const types = new PrismaSourceTypeRepository(prisma);

const NOW = new Date("2026-06-19T00:00:00.000Z");

async function aWordId(term = "ramble"): Promise<string> {
  const w = await words.create({
    term,
    definitionEn: "x",
    definitionPt: "y",
    examples: [],
    nextReview: NOW,
  });
  return w.id;
}

async function aSourceId(name = "S"): Promise<string> {
  const sourceTypeId = (await types.findByName("Vídeo"))
    ? (await types.findByName("Vídeo"))!.id
    : (await types.create("Vídeo")).id;
  return (await sources.create({ name, sourceTypeId })).id;
}

beforeEach(resetDb);

describe("PrismaWordSightingRepository — record", () => {
  it("records a re-encounter (isFirstEncounter false)", async () => {
    const wordId = await aWordId();
    const sourceId = await aSourceId();
    const sighting = await repo.record({
      wordId,
      sourceId,
      seenAt: NOW,
      isFirstEncounter: false,
    });
    expect(sighting.isFirstEncounter).toBe(false);
    expect(sighting.contextSentence).toBeNull();
  });
});

describe("PrismaWordSightingRepository — findById & update", () => {
  it("starts with no per-source definition and updates it", async () => {
    const wordId = await aWordId();
    const sourceId = await aSourceId();
    const created = await repo.record({
      wordId,
      sourceId,
      seenAt: NOW,
      isFirstEncounter: true,
    });
    expect(created.definitionEn).toBeNull();
    expect(created.examples).toEqual([]);

    const updated = await repo.update(created.id, {
      definitionEn: "in this source it means X",
      definitionPt: "nesta fonte significa X",
      examples: ["source example 1", "source example 2"],
      contextSentence: "the real sentence here",
    });
    expect(updated.definitionEn).toBe("in this source it means X");
    expect(updated.definitionPt).toBe("nesta fonte significa X");
    expect(updated.examples).toEqual(["source example 1", "source example 2"]);
    expect(updated.contextSentence).toBe("the real sentence here");

    const reloaded = await repo.findById(created.id);
    expect(reloaded?.definitionEn).toBe("in this source it means X");
  });

  it("only touches the fields provided (omitted keys stay unchanged)", async () => {
    const wordId = await aWordId();
    const sourceId = await aSourceId();
    const created = await repo.record({
      wordId,
      sourceId,
      seenAt: NOW,
      contextSentence: "original context",
      isFirstEncounter: true,
    });
    // Empty update: nothing provided — every field must stay as it was.
    const updated = await repo.update(created.id, {});
    expect(updated.contextSentence).toBe("original context");
    expect(updated.definitionEn).toBeNull();
    expect(updated.definitionPt).toBeNull();
    expect(updated.examples).toEqual([]);
  });

  it("returns null for an unknown sighting id", async () => {
    expect(await repo.findById("missing")).toBeNull();
  });
});

describe("PrismaWordSightingRepository — listByWord", () => {
  it("lists a word's sightings across sources, oldest first", async () => {
    const wordId = await aWordId();
    const s1 = await aSourceId("Source 1");
    const s2 = await aSourceId("Source 2");
    await repo.record({
      wordId,
      sourceId: s1,
      seenAt: new Date("2026-06-19T00:00:00.000Z"),
      isFirstEncounter: true,
    });
    await repo.record({
      wordId,
      sourceId: s2,
      seenAt: new Date("2026-06-25T00:00:00.000Z"),
      isFirstEncounter: false,
    });
    const sightings = await repo.listByWord(wordId);
    expect(sightings.map((s) => s.sourceId)).toEqual([s1, s2]);
  });
});

describe("PrismaWordSightingRepository — listSince", () => {
  it("includes the boundary instant (gte) and orders ascending", async () => {
    const wordId = await aWordId();
    const sourceId = await aSourceId();
    const cutoff = new Date("2026-06-15T00:00:00.000Z");
    await repo.record({
      wordId,
      sourceId,
      seenAt: new Date("2026-06-18T00:00:00.000Z"),
      isFirstEncounter: false,
    });
    await repo.record({
      wordId,
      sourceId,
      seenAt: new Date("2026-06-14T23:59:59.999Z"), // just before — excluded
      isFirstEncounter: true,
    });
    await repo.record({
      wordId,
      sourceId,
      seenAt: cutoff, // exactly at the boundary — included
      isFirstEncounter: false,
    });

    const sightings = await repo.listSince(cutoff);
    expect(sightings.map((s) => s.seenAt.toISOString())).toEqual([
      cutoff.toISOString(),
      "2026-06-18T00:00:00.000Z",
    ]);
  });
});

describe("PrismaWordSightingRepository — listSeenDates", () => {
  it("returns EVERY seenAt instant, oldest first", async () => {
    const wordId = await aWordId();
    const sourceId = await aSourceId();
    await repo.record({
      wordId,
      sourceId,
      seenAt: new Date("2026-06-18T00:00:00.000Z"),
      isFirstEncounter: false,
    });
    await repo.record({
      wordId,
      sourceId,
      seenAt: new Date("2025-01-01T00:00:00.000Z"), // ancient — still listed
      isFirstEncounter: true,
    });

    const dates = await repo.listSeenDates();
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2025-01-01T00:00:00.000Z",
      "2026-06-18T00:00:00.000Z",
    ]);
  });
});

describe("PrismaWordSightingRepository — listBySource", () => {
  it("lists the sightings recorded in a given source", async () => {
    const sourceId = await aSourceId();
    const w1 = await aWordId("ramble");
    const w2 = await aWordId("rambling");
    await repo.record({ wordId: w1, sourceId, seenAt: NOW, isFirstEncounter: true });
    await repo.record({ wordId: w2, sourceId, seenAt: NOW, isFirstEncounter: false });
    const sightings = await repo.listBySource(sourceId);
    expect(sightings).toHaveLength(2);
    expect(sightings.map((s) => s.isFirstEncounter).sort()).toEqual([false, true]);
  });
});
