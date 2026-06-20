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
