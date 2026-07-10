import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../test/helpers/db.js";
import { createRepositories } from "../infra/prisma/repositories.js";
import { ensureSource, ensureSourceType } from "./sources.js";
import { registerNewWord } from "./words.js";
import {
  autoCorrectExam,
  generateSourceComprehensionExam,
  srsQualityForAnswer,
  submitExamAnswers,
  submitExamCorrection,
} from "./exam.js";
import type { AiProvider } from "../domain/index.js";

const repos = createRepositories(getTestPrisma());
const NOW = new Date("2026-06-19T00:00:00.000Z");

async function makeWord(term: string, createdAt = NOW): Promise<string> {
  const w = await repos.words.create({
    term,
    definitionEn: `${term}-en`,
    definitionPt: `${term}-pt`,
    examples: [`${term} example`],
    nextReview: NOW,
    createdAt,
  });
  return w.id;
}

/** A legacy copy-paste exam (status "gerada"), as the manual flow creates it. */
async function makeLegacyExam(): Promise<string> {
  const exam = await repos.exams.create({
    type: "vocabulario",
    promptText: "prova legada (copiar/colar)",
  });
  return exam.id;
}

beforeEach(resetDb);

describe("srsQualityForAnswer", () => {
  it("maps a correct answer to a passing grade and a wrong one to a failing grade", () => {
    expect(srsQualityForAnswer(true)).toBeGreaterThanOrEqual(3);
    expect(srsQualityForAnswer(false)).toBeLessThan(3);
  });
});

describe("generateSourceComprehensionExam", () => {
  const compDeps = () => ({
    sources: repos.sources,
    sightings: repos.sightings,
    words: repos.words,
    exams: repos.exams,
  });

  it("throws for an unknown source", async () => {
    await expect(
      generateSourceComprehensionExam(compDeps(), "ghost", undefined, NOW),
    ).rejects.toThrow();
  });

  it("works without a transcript (questions stay general)", async () => {
    const typeId = (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
    const sourceId = (
      await ensureSource(repos.sources, { name: "NoScript", sourceTypeId: typeId })
    ).id;
    const exam = await generateSourceComprehensionExam(
      compDeps(),
      sourceId,
      undefined,
      NOW,
    );
    expect(exam.type).toBe("compreensao");
    expect(exam.promptText).toContain("NoScript");
  });

  it("creates a 'compreensao' exam tied to the source, embedding the transcript", async () => {
    const typeId = (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
    const sourceId = (
      await ensureSource(repos.sources, { name: "Fireship", sourceTypeId: typeId })
    ).id;
    await registerNewWord(
      repos.words,
      {
        term: "ramble",
        definitionEn: "x",
        definitionPt: "y",
        examples: ["e"],
        sourceId,
      },
      NOW,
    );

    const exam = await generateSourceComprehensionExam(
      {
        sources: repos.sources,
        sightings: repos.sightings,
        words: repos.words,
        exams: repos.exams,
      },
      sourceId,
      "Transcript: TypeScript adds types.",
      NOW,
    );
    expect(exam.type).toBe("compreensao");
    expect(exam.sourceId).toBe(sourceId);
    expect(exam.promptText).toContain("Fireship");
    expect(exam.promptText).toContain("Transcript: TypeScript adds types.");
  });
});

describe("submitExamAnswers", () => {
  it("stores answers, builds a correction prompt, and moves to respondida", async () => {
    await makeWord("ramble");
    const examId = await makeLegacyExam();
    const answers = "1. ramble = divagar";
    const updated = await submitExamAnswers(repos.exams, examId, answers);
    expect(updated.status).toBe("respondida");
    expect(updated.correctionPrompt).toContain(answers);
  });

  it("throws for an unknown exam id", async () => {
    await expect(
      submitExamAnswers(repos.exams, "ghost", "answers"),
    ).rejects.toThrow();
  });
});

describe("submitExamCorrection (the high-risk cycle §6.2)", () => {
  async function setup() {
    const rambleId = await makeWord("ramble");
    const ramblingId = await makeWord("rambling");
    const examId = await makeLegacyExam();
    return { rambleId, ramblingId, examId };
  }

  function resultJson(extraGhost = false): string {
    const items = [
      { term: "ramble", correct: true, note: "ok" },
      { term: "rambling", correct: false, note: "errou" },
    ];
    if (extraGhost) items.push({ term: "ghost", correct: true, note: "?" });
    return JSON.stringify({ score: 50, items, feedback: "ok" });
  }

  it("validates the JSON, updates SRS per answer, and marks the exam corrigida", async () => {
    const { rambleId, ramblingId, examId } = await setup();

    const result = await submitExamCorrection(
      { words: repos.words, exams: repos.exams },
      examId,
      resultJson(),
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exam.status).toBe("corrigida");
    expect(result.exam.score).toBe(50);

    // Correct answer (quality 5): first successful review -> reps 1, interval 1.
    const ramble = await repos.words.findById(rambleId);
    expect(ramble?.repetitions).toBe(1);
    expect(ramble?.intervalDays).toBe(1);

    // Wrong answer (quality < 3): stays/returns to reps 0.
    const rambling = await repos.words.findById(ramblingId);
    expect(rambling?.repetitions).toBe(0);

    // A review log per graded word.
    expect(await repos.reviewLogs.listByWord(rambleId)).toHaveLength(1);
  });

  it("reports terms that match no word and skips them (no SRS write)", async () => {
    const { examId } = await setup();
    const result = await submitExamCorrection(
      { words: repos.words, exams: repos.exams },
      examId,
      resultJson(true),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unmatchedTerms).toEqual(["ghost"]);
  });

  it("returns a clear error for invalid JSON without changing the exam", async () => {
    const { examId } = await setup();
    const result = await submitExamCorrection(
      { words: repos.words, exams: repos.exams },
      examId,
      "not json at all",
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/JSON/i);
    // Exam untouched.
    expect((await repos.exams.findById(examId))?.status).toBe("gerada");
  });
});

describe("autoCorrectExam (ADR-001 ApiAdapter path)", () => {
  // A fake AiProvider stands in for the external API — the legitimate use of a
  // test double, since the provider IS the boundary we're isolating.
  function fakeProvider(response: string): AiProvider {
    return { name: "fake", complete: async () => response };
  }

  async function aGeneratedExam(): Promise<{ rambleId: string; examId: string }> {
    const rambleId = await makeWord("ramble");
    const examId = await makeLegacyExam();
    return { rambleId, examId };
  }

  it("runs the full cycle: answers -> correction prompt -> AI -> validated SRS update", async () => {
    const { rambleId, examId } = await aGeneratedExam();
    const provider = fakeProvider(
      JSON.stringify({
        score: 100,
        items: [{ term: "ramble", correct: true, note: "ok" }],
        feedback: "great",
      }),
    );

    const result = await autoCorrectExam(
      { words: repos.words, exams: repos.exams },
      provider,
      examId,
      "1. ramble = divagar",
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exam.status).toBe("corrigida");
    expect(result.exam.score).toBe(100);
    expect((await repos.words.findById(rambleId))?.repetitions).toBe(1);
  });

  it("surfaces a validation error when the AI returns malformed JSON", async () => {
    const { examId } = await aGeneratedExam();
    const result = await autoCorrectExam(
      { words: repos.words, exams: repos.exams },
      fakeProvider("desculpe, não consegui"),
      examId,
      "respostas",
      NOW,
    );
    expect(result.ok).toBe(false);
  });
});
