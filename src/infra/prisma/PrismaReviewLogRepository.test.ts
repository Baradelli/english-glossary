import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import { PrismaReviewLogRepository } from "./PrismaReviewLogRepository.js";
import { PrismaWordRepository } from "./PrismaWordRepository.js";

const prisma = getTestPrisma();
const repo = new PrismaReviewLogRepository(prisma);
const words = new PrismaWordRepository(prisma);

async function aWordId(): Promise<string> {
  const w = await words.create({
    term: "ramble",
    definitionEn: "x",
    definitionPt: "y",
    examples: [],
    nextReview: new Date("2026-06-19T00:00:00.000Z"),
  });
  return w.id;
}

beforeEach(resetDb);

describe("PrismaReviewLogRepository", () => {
  it("creates a review log entry", async () => {
    const wordId = await aWordId();
    const log = await repo.create({
      wordId,
      quality: 5,
      reviewedAt: new Date("2026-06-19T00:00:00.000Z"),
      intervalDays: 1,
    });
    expect(log.id).toBeTruthy();
    expect(log.quality).toBe(5);
    expect(log.intervalDays).toBe(1);
  });

  it("lists a word's logs oldest first", async () => {
    const wordId = await aWordId();
    await repo.create({
      wordId,
      quality: 5,
      reviewedAt: new Date("2026-06-19T00:00:00.000Z"),
      intervalDays: 1,
    });
    await repo.create({
      wordId,
      quality: 4,
      reviewedAt: new Date("2026-06-25T00:00:00.000Z"),
      intervalDays: 6,
    });
    const logs = await repo.listByWord(wordId);
    expect(logs.map((l) => l.quality)).toEqual([5, 4]);
  });

  it("counts reviews at or after a given date", async () => {
    const wordId = await aWordId();
    await repo.create({
      wordId,
      quality: 5,
      reviewedAt: new Date("2026-06-01T00:00:00.000Z"),
      intervalDays: 1,
    });
    await repo.create({
      wordId,
      quality: 4,
      reviewedAt: new Date("2026-06-18T00:00:00.000Z"),
      intervalDays: 6,
    });
    expect(await repo.countSince(new Date("2026-06-15T00:00:00.000Z"))).toBe(1);
    expect(await repo.countSince(new Date("2026-05-01T00:00:00.000Z"))).toBe(2);
  });

  it("listSince includes the boundary instant (gte) and orders ascending", async () => {
    const wordId = await aWordId();
    const cutoff = new Date("2026-06-15T00:00:00.000Z");
    await repo.create({
      wordId,
      quality: 4,
      reviewedAt: new Date("2026-06-18T00:00:00.000Z"),
      intervalDays: 6,
    });
    await repo.create({
      wordId,
      quality: 2,
      reviewedAt: new Date("2026-06-14T23:59:59.999Z"), // just before — excluded
      intervalDays: 1,
    });
    await repo.create({
      wordId,
      quality: 5,
      reviewedAt: cutoff, // exactly at the boundary — included
      intervalDays: 1,
    });

    const logs = await repo.listSince(cutoff);
    expect(logs.map((l) => l.quality)).toEqual([5, 4]);
    expect(logs[0]?.reviewedAt.toISOString()).toBe(cutoff.toISOString());
  });

  it("listReviewDates returns EVERY reviewedAt instant, oldest first", async () => {
    const wordId = await aWordId();
    await repo.create({
      wordId,
      quality: 4,
      reviewedAt: new Date("2026-06-18T00:00:00.000Z"),
      intervalDays: 6,
    });
    await repo.create({
      wordId,
      quality: 5,
      reviewedAt: new Date("2025-01-01T00:00:00.000Z"), // ancient — still listed
      intervalDays: 1,
    });

    const dates = await repo.listReviewDates();
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2025-01-01T00:00:00.000Z",
      "2026-06-18T00:00:00.000Z",
    ]);
  });
});
