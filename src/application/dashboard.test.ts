import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../test/helpers/db.js";
import { createRepositories } from "../infra/prisma/repositories.js";
import { ensureSource, ensureSourceType } from "./sources.js";
import { getDashboardData } from "./dashboard.js";

const repos = createRepositories(getTestPrisma());
const NOW = new Date("2026-06-19T12:00:00.000Z");
const TZ = 0; // tests speak UTC; local-day math itself is covered in localDay.test.ts
const deps = {
  words: repos.words,
  sources: repos.sources,
  reviewLogs: repos.reviewLogs,
  sightings: repos.sightings,
  exams: repos.exams,
};

async function word(term: string, createdAt: Date = NOW): Promise<string> {
  return (
    await repos.words.create({
      term,
      definitionEn: "x",
      definitionPt: "y",
      examples: ["e"],
      nextReview: NOW,
      createdAt,
    })
  ).id;
}

async function sourceId(): Promise<string> {
  const typeId = (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
  return (await ensureSource(repos.sources, { name: "S", sourceTypeId: typeId }))
    .id;
}

const SRS_RESET = {
  easeFactor: 2.5,
  intervalDays: 1,
  repetitions: 0,
  nextReview: NOW,
};

beforeEach(resetDb);

describe("getDashboardData", () => {
  it("returns the full zeroed shape (no NaN) on an empty database", async () => {
    const data = await getDashboardData(deps, NOW, TZ);

    expect(data.today).toEqual({
      streakDays: 0,
      dueNowCount: 0,
      dueLaterTodayCount: 0,
      reviewedTodayCount: 0,
      capturedTodayCount: 0,
    });
    expect(data.activity.totalActions).toBe(0);
    expect(data.activity.activeDayCount).toBe(0);
    expect(data.forecast.dueNowCount).toBe(0);
    expect(data.forecast.weekTotal).toBe(0);
    expect(data.forecast.maxCount).toBe(0);
    expect(data.growth).toEqual({
      points: [],
      totalWords: 0,
      firstKey: null,
      spanDays: 0,
    });
    expect(data.composition).toEqual({ nova: 0, aprendendo: 0, dominada: 0 });
    expect(data.scoreTrend).toEqual([]);
    expect(data.difficultWords).toEqual([]);
    expect(data.totals.words).toEqual({
      total: 0,
      nova: 0,
      aprendendo: 0,
      dominada: 0,
    });
    expect(data.totals.sources).toBe(0);
    expect(data.totals.reviewsLast7Days).toBe(0);
    expect(data.totals.exams).toEqual({
      total: 0,
      corrected: 0,
      averageScore: null,
    });
  });

  it("counts words by derived state (§6.1) in totals and composition", async () => {
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

    const data = await getDashboardData(deps, NOW, TZ);
    expect(data.totals.words).toEqual({
      total: 3,
      nova: 1,
      aprendendo: 1,
      dominada: 1,
    });
    expect(data.composition).toEqual({ nova: 1, aprendendo: 1, dominada: 1 });
  });

  it("counts sources and reviews within the last 7 days in totals", async () => {
    await sourceId();
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

    const data = await getDashboardData(deps, NOW, TZ);
    expect(data.totals.sources).toBe(1);
    expect(data.totals.reviewsLast7Days).toBe(1);
  });

  it("counts CONCLUDED exams (corrigida AND finalizada) in totals", async () => {
    await repos.exams.create({ type: "semanal", promptText: "p" }); // gerada — ignored
    const legacy = await repos.exams.create({
      type: "vocabulario",
      promptText: "p",
    });
    await repos.exams.submitCorrection(legacy.id, {
      resultJson: { score: 80, items: [], feedback: "ok" },
      score: 80,
      words: [],
    });
    const wordId = await word("blend");
    const quiz = await repos.exams.createQuiz({
      type: "vocabulario",
      questions: [
        {
          wordId,
          position: 0,
          type: "typed",
          prompt: "?",
          options: null,
          correctIndex: null,
          correctAnswer: "blend",
          contextSentence: null,
          explanation: null,
        },
      ],
    });
    await repos.exams.finishQuiz(quiz.id, {
      score: 60,
      finishedAt: NOW,
      words: [
        {
          wordId,
          correct: true,
          srs: SRS_RESET,
          reviewLog: { quality: 5, reviewedAt: NOW },
        },
      ],
    });

    const data = await getDashboardData(deps, NOW, TZ);
    expect(data.totals.exams).toEqual({
      total: 3,
      corrected: 2,
      averageScore: 70,
    });
  });

  it("assembles activity, forecast, growth, trend and difficult words from a seeded database", async () => {
    const src = await sourceId();
    const tricky = await word("tricky", new Date("2026-06-10T09:00:00.000Z"));
    const smooth = await word("smooth", new Date("2026-06-18T09:00:00.000Z"));

    // Capture today (sighting) + review yesterday → 2-day streak ending today.
    await repos.sightings.record({
      wordId: tricky,
      sourceId: src,
      seenAt: new Date("2026-06-19T10:00:00.000Z"),
      isFirstEncounter: true,
    });
    await repos.reviewLogs.create({
      wordId: smooth,
      quality: 4,
      reviewedAt: new Date("2026-06-18T09:00:00.000Z"),
      intervalDays: 1,
    });

    // Legacy copy-paste exam, corrected by the AI flow.
    const legacy = await repos.exams.create({
      type: "vocabulario",
      promptText: "p",
      createdAt: new Date("2026-06-17T12:00:00.000Z"),
    });
    await repos.exams.submitCorrection(legacy.id, {
      resultJson: { score: 80, items: [], feedback: "ok" },
      score: 80,
      words: [],
    });

    // Local quiz finished today with a miss on "tricky": writes BOTH the
    // ExamWord (correct=false) and the quality-2 ReviewLog.
    const quiz = await repos.exams.createQuiz({
      type: "semanal",
      createdAt: new Date("2026-06-19T11:00:00.000Z"),
      questions: [
        {
          wordId: tricky,
          position: 0,
          type: "typed",
          prompt: "?",
          options: null,
          correctIndex: null,
          correctAnswer: "tricky",
          contextSentence: null,
          explanation: null,
        },
      ],
    });
    await repos.exams.finishQuiz(quiz.id, {
      score: 0,
      finishedAt: NOW,
      words: [
        {
          wordId: tricky,
          correct: false,
          srs: SRS_RESET,
          reviewLog: { quality: 2, reviewedAt: NOW },
        },
      ],
    });

    const data = await getDashboardData(deps, NOW, TZ);

    // Activity: 1 sighting + 2 review logs (yesterday's + the quiz's).
    expect(data.activity.totalActions).toBe(3);
    expect(data.activity.activeDayCount).toBe(2);
    expect(data.today.streakDays).toBe(2);
    expect(data.today.reviewedTodayCount).toBe(1);
    expect(data.today.capturedTodayCount).toBe(1);

    // Both words are scheduled at or before NOW → due right now.
    expect(data.forecast.dueNowCount).toBe(2);
    expect(data.today.dueNowCount).toBe(2);
    expect(data.today.dueLaterTodayCount).toBe(0);

    expect(data.growth.totalWords).toBe(2);
    expect(data.growth.firstKey).toBe("2026-06-10");

    // Trend includes BOTH conclusion statuses, ascending by creation date.
    expect(data.scoreTrend.map((p) => [p.examId, p.score])).toEqual([
      [legacy.id, 80],
      [quiz.id, 0],
    ]);

    // Term resolved via the glossary Map; the exam miss counts ONCE — the
    // quality-2 log already covers it (failedReviews 1, not 2), and the
    // ExamWord stays a display fact.
    expect(data.difficultWords).toEqual([
      {
        wordId: tricky,
        term: "tricky",
        kind: "palavra",
        examErrors: 1,
        failedReviews: 1,
      },
    ]);
  });

  it("drops a difficult-word entry whose wordId no longer resolves", async () => {
    // ReviewLog cascades away with its word in the real schema, so the orphan
    // is simulated at the port: a failed review pointing at an unknown word.
    const reviewLogs = {
      create: repos.reviewLogs.create.bind(repos.reviewLogs),
      listByWord: repos.reviewLogs.listByWord.bind(repos.reviewLogs),
      countSince: repos.reviewLogs.countSince.bind(repos.reviewLogs),
      listSince: async () => [
        {
          id: "log-orphan",
          wordId: "gone",
          quality: 2,
          reviewedAt: NOW,
          intervalDays: 1,
        },
      ],
      // The activity calendar reads dates from here (unwindowed), so the
      // orphan's instant must show up too for it to count as activity.
      listReviewDates: async () => [NOW],
    };

    const data = await getDashboardData({ ...deps, reviewLogs }, NOW, TZ);
    expect(data.difficultWords).toEqual([]);
    expect(data.activity.totalActions).toBe(1); // the log still counts as activity
  });
});
