/**
 * Exam cycle use cases (Fluxo C, Manual mode) — the project's highest-risk
 * flow. Two turns: generate a question prompt, paste answers back (which yields
 * the correction prompt), then submit the AI's JSON. Submission validates the
 * JSON, maps each answer to an SM-2 review, and persists everything in the
 * repository's transaction. The real clock is injected as `now`.
 */

import {
  buildCorrectionPrompt,
  buildSourceComprehensionPrompt,
  buildVocabularyExamPrompt,
  buildWeeklyReviewPrompt,
  parseExamResult,
  reviewWord,
  type Exam,
  type ExamRepository,
  type PromptWord,
  type SourceRepository,
  type Word,
  type WordCorrection,
  type WordRepository,
  type WordSightingRepository,
} from "../domain/index.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Maps a graded answer to an SM-2 quality: pass = 5, fail = 2 (forces reset). */
export function srsQualityForAnswer(correct: boolean): number {
  return correct ? 5 : 2;
}

function toPromptWord(word: Word): PromptWord {
  return {
    term: word.term,
    definitionEn: word.definitionEn,
    definitionPt: word.definitionPt,
    examples: word.examples,
  };
}

async function resolveWords(
  words: WordRepository,
  ids: readonly string[],
): Promise<Word[]> {
  const resolved: Word[] = [];
  for (const id of ids) {
    const word = await words.findById(id);
    if (word) resolved.push(word);
  }
  return resolved;
}

export async function generateWeeklyReviewExam(
  deps: { words: WordRepository; exams: ExamRepository },
  now: Date,
): Promise<Exam> {
  const since = now.getTime() - WEEK_MS;
  const recent = (await deps.words.listAll()).filter(
    (word) => word.createdAt.getTime() >= since,
  );
  if (recent.length === 0) {
    throw new Error("Nenhuma palavra na última semana para revisar.");
  }
  const promptText = buildWeeklyReviewPrompt(recent.map(toPromptWord));
  return deps.exams.create({ type: "semanal", promptText });
}

export async function generateVocabularyExam(
  deps: { words: WordRepository; exams: ExamRepository },
  wordIds: readonly string[],
  _now: Date,
): Promise<Exam> {
  const words = await resolveWords(deps.words, wordIds);
  if (words.length === 0) {
    throw new Error("Selecione ao menos uma palavra para a prova.");
  }
  const promptText = buildVocabularyExamPrompt(words.map(toPromptWord));
  return deps.exams.create({ type: "vocabulario", promptText });
}

export async function generateSourceComprehensionExam(
  deps: {
    sources: SourceRepository;
    sightings: WordSightingRepository;
    words: WordRepository;
    exams: ExamRepository;
  },
  sourceId: string,
  transcript: string | undefined,
  _now: Date,
): Promise<Exam> {
  const source = await deps.sources.findById(sourceId);
  if (!source) throw new Error(`Fonte inexistente: ${sourceId}`);

  const sightings = await deps.sightings.listBySource(sourceId);
  const uniqueWordIds = [...new Set(sightings.map((s) => s.wordId))];
  const words = await resolveWords(deps.words, uniqueWordIds);

  const promptText = buildSourceComprehensionPrompt({
    source: { name: source.name },
    words: words.map(toPromptWord),
    ...(transcript ? { transcript } : {}),
  });
  return deps.exams.create({
    type: "compreensao",
    sourceId,
    promptText,
  });
}

export async function submitExamAnswers(
  exams: ExamRepository,
  examId: string,
  answersText: string,
): Promise<Exam> {
  const exam = await exams.findById(examId);
  if (!exam) throw new Error(`Prova inexistente: ${examId}`);
  const correctionPrompt = buildCorrectionPrompt({ answersText });
  return exams.saveAnswers(examId, { answersText, correctionPrompt });
}

export type SubmitCorrectionResult =
  | { readonly ok: true; readonly exam: Exam; readonly unmatchedTerms: string[] }
  | { readonly ok: false; readonly error: string };

/**
 * Validates the pasted correction JSON and, if valid, computes an SM-2 review
 * for every term that matches a word, then persists the correction atomically.
 * Terms with no matching word are reported and skipped (never invent SRS data).
 */
export async function submitExamCorrection(
  deps: { words: WordRepository; exams: ExamRepository },
  examId: string,
  resultText: string,
  now: Date,
): Promise<SubmitCorrectionResult> {
  const parsed = parseExamResult(resultText);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const corrections: WordCorrection[] = [];
  const unmatchedTerms: string[] = [];

  for (const item of parsed.value.items) {
    const word = await deps.words.findByTerm(item.term);
    if (!word) {
      unmatchedTerms.push(item.term);
      continue;
    }
    const quality = srsQualityForAnswer(item.correct);
    const srs = reviewWord(word, quality, now);
    corrections.push({
      wordId: word.id,
      correct: item.correct,
      srs: {
        easeFactor: srs.easeFactor,
        intervalDays: srs.intervalDays,
        repetitions: srs.repetitions,
        nextReview: srs.nextReview,
      },
      reviewLog: { quality, reviewedAt: now },
    });
  }

  const exam = await deps.exams.submitCorrection(examId, {
    resultJson: parsed.value,
    score: parsed.value.score,
    words: corrections,
  });

  return { ok: true, exam, unmatchedTerms };
}
