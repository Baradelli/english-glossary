import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../test/helpers/db.js";
import { createRepositories } from "../infra/prisma/repositories.js";
import { ensureSource, ensureSourceType } from "./sources.js";
import { getDashboardMetrics } from "./dashboard.js";

const repos = createRepositories(getTestPrisma());
const NOW = new Date("2026-06-19T00:00:00.000Z");
const deps = {
  words: repos.words,
  sources: repos.sources,
  reviewLogs: repos.reviewLogs,
  exams: repos.exams,
};

async function word(term: string): Promise<string> {
  return (
    await repos.words.create({
      term,
      definitionEn: "x",
      definitionPt: "y",
      examples: ["e"],
      nextReview: NOW,
    })
  ).id;
}

beforeEach(resetDb);

describe("getDashboardMetrics", () => {
  it("reports zeros on an empty database", async () => {
    const m = await getDashboardMetrics(deps, NOW);
    expect(m.words).toEqual({ total: 0, nova: 0, aprendendo: 0, dominada: 0 });
    expect(m.sources).toBe(0);
    expect(m.reviewsLast7Days).toBe(0);
    expect(m.exams).toEqual({ total: 0, corrected: 0, averageScore: null });
  });

  it("counts words by derived state (§6.1)", async () => {
    await word("nova-word"); // reps 0 -> nova
    const learning = await word("learning");
    await repos.words.updateSrs(learning, {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
      nextReview: NOW,
    });
    const mastered = await word("mastered");
    await repos.words.updateSrs(mastered, {
      easeFactor: 2.5,
      intervalDays: 30,
      repetitions: 3,
      nextReview: NOW,
    });

    const m = await getDashboardMetrics(deps, NOW);
    expect(m.words).toEqual({
      total: 3,
      nova: 1,
      aprendendo: 1,
      dominada: 1,
    });
  });

  it("counts sources and reviews within the last 7 days", async () => {
    const typeId = (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
    await ensureSource(repos.sources, { name: "S", sourceTypeId: typeId });
    const id = await word("ramble");
    await repos.reviewLogs.create({
      wordId: id,
      quality: 5,
      reviewedAt: new Date("2026-06-18T00:00:00.000Z"), // within 7 days
      intervalDays: 1,
    });
    await repos.reviewLogs.create({
      wordId: id,
      quality: 3,
      reviewedAt: new Date("2026-06-01T00:00:00.000Z"), // older
      intervalDays: 1,
    });

    const m = await getDashboardMetrics(deps, NOW);
    expect(m.sources).toBe(1);
    expect(m.reviewsLast7Days).toBe(1);
  });

  it("summarises exams (total, corrected, average score)", async () => {
    await repos.exams.create({ type: "semanal", promptText: "p" }); // gerada
    const e = await repos.exams.create({ type: "vocabulario", promptText: "p" });
    await repos.exams.submitCorrection(e.id, {
      resultJson: { score: 80, items: [], feedback: "ok" },
      score: 80,
      words: [],
    });

    const m = await getDashboardMetrics(deps, NOW);
    expect(m.exams).toEqual({ total: 2, corrected: 1, averageScore: 80 });
  });
});
