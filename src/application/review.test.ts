import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../test/helpers/db.js";
import { createRepositories } from "../infra/prisma/repositories.js";
import { getReviewQueue, reviewWordById } from "./review.js";

const repos = createRepositories(getTestPrisma());
const NOW = new Date("2026-06-19T00:00:00.000Z");

async function makeWord(term: string, nextReview: Date): Promise<string> {
  const w = await repos.words.create({
    term,
    definitionEn: "x",
    definitionPt: "y",
    examples: ["e"],
    nextReview,
  });
  return w.id;
}

beforeEach(resetDb);

describe("getReviewQueue", () => {
  it("returns words due at or before now, oldest first", async () => {
    await makeWord("future", new Date("2026-06-30T00:00:00.000Z"));
    await makeWord("due-b", new Date("2026-06-18T00:00:00.000Z"));
    await makeWord("due-a", new Date("2026-06-10T00:00:00.000Z"));
    const queue = await getReviewQueue(repos.words, NOW);
    expect(queue.map((w) => w.term)).toEqual(["due-a", "due-b"]);
  });
});

describe("reviewWordById", () => {
  it("applies SM-2, reschedules the word, and logs the review", async () => {
    const id = await makeWord("ramble", NOW);
    const updated = await reviewWordById(
      { words: repos.words },
      { wordId: id, quality: 5 },
      NOW,
    );
    // First successful review: reps 1, interval 1, due tomorrow.
    expect(updated.repetitions).toBe(1);
    expect(updated.intervalDays).toBe(1);
    expect(updated.nextReview.toISOString()).toBe("2026-06-20T00:00:00.000Z");

    // It leaves today's queue and a log was written.
    expect(await getReviewQueue(repos.words, NOW)).toHaveLength(0);
    expect(await repos.reviewLogs.listByWord(id)).toHaveLength(1);
  });

  it("rejects an out-of-range quality", async () => {
    const id = await makeWord("ramble", NOW);
    await expect(
      reviewWordById({ words: repos.words }, { wordId: id, quality: 9 }, NOW),
    ).rejects.toThrow();
  });

  it("throws for an unknown word", async () => {
    await expect(
      reviewWordById({ words: repos.words }, { wordId: "ghost", quality: 5 }, NOW),
    ).rejects.toThrow();
  });
});
