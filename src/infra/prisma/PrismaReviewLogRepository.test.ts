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
});
