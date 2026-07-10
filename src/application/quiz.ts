/**
 * Quiz use cases (ADR-009). The app decides WHICH words enter the quiz (weekly
 * window, weighted vocabulary sample, missed words) and the AI writes every
 * question — multiple choice only, replying in the strict AiQuiz JSON the app
 * validates before persisting. Grading stays entirely server-side and local:
 * the answer key never reaches the client before the user answers, and the AI
 * never grades anything. Dates always come from the caller.
 */

import {
  buildAiQuizQuestions,
  buildQuizGenerationPrompt,
  computeScore,
  gradeAnswer,
  parseAiQuiz,
  reviewWord,
  selectVocabularyWords,
  selectWeeklyWords,
  createRng,
  type AiProvider,
  type Exam,
  type ExamQuestion,
  type ExamRepository,
  type ExamType,
  type PromptWord,
  type QuizQuestion,
  type QuizWordInput,
  type Word,
  type WordCorrection,
  type WordRepository,
  type WordSightingRepository,
} from "../domain/index.js";
import { srsQualityForAnswer } from "./exam.js";

export interface QuizDeps {
  readonly words: WordRepository;
  readonly sightings: WordSightingRepository;
  readonly exams: ExamRepository;
}

export interface QuizOptions {
  /** Injected seed (the action passes Date.now()); shuffles options/order. */
  readonly seed: number;
  /** The AI provider that writes the questions — required to open a quiz. */
  readonly ai?: AiProvider | null;
}

export interface AnswerQuizInput {
  readonly examId: string;
  readonly questionId: string;
  /** MC: chosen index as a string ("0".."3"); legacy typed/cloze: free text. */
  readonly answer: string;
}

/** What the client learns AFTER answering — never before. */
export interface AnswerFeedback {
  readonly isCorrect: boolean;
  /** The correct alternative's text (MC) or the expected answer (typed/cloze). */
  readonly correctAnswer: string;
  /** The source sentence backing the question, when there is one. */
  readonly contextSentence: string | null;
  /** Short PT explanation of the correct answer (AI questions). */
  readonly explanation: string | null;
  /** Questions answered so far in this exam (including this one). */
  readonly answered: number;
  readonly total: number;
}

/** Generation waits longer than a chat turn: a whole exam is being written. */
const AI_GENERATION_TIMEOUT_MS = 90_000;

export const NO_AI_PROVIDER_MESSAGE =
  "As provas são geradas pela IA — configure sua chave de API em Configurações.";

export const AI_QUIZ_FAILED_MESSAGE =
  "A IA não retornou uma prova válida. Tente novamente em instantes.";

function toQuizWordInput(
  word: Word,
  contextSentences: readonly string[],
): QuizWordInput {
  return {
    id: word.id,
    term: word.term,
    kind: word.kind,
    definitionEn: word.definitionEn,
    definitionPt: word.definitionPt,
    observations: word.observations,
    contextSentences,
  };
}

/** Enriches a quiz word with the real sentences it was seen in. */
async function withContextSentences(
  sightings: WordSightingRepository,
  word: Word,
): Promise<QuizWordInput> {
  const seen = await sightings.listByWord(word.id);
  const sentences = seen
    .map((s) => (s.contextSentence ?? "").trim())
    .filter((s) => s.length > 0);
  return toQuizWordInput(word, sentences);
}

/** Rejects after `ms` so a stalled provider never hangs the quiz start. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Tempo esgotado ao consultar a IA.")),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function toPromptWord(word: QuizWordInput): PromptWord {
  return {
    term: word.term,
    definitionEn: word.definitionEn,
    definitionPt: word.definitionPt,
    observations: word.observations,
    contextSentences: word.contextSentences,
  };
}

/**
 * Asks the AI to write the whole quiz and validates the reply into
 * persistable questions. A reply that fails to parse — or parses but yields
 * zero usable questions (no term match, dishonest options) — is retried once
 * with a fresh call; a second failure surfaces as an error, never as an empty
 * exam. Exported for tests.
 */
export async function generateQuizWithAi(
  provider: AiProvider,
  words: readonly QuizWordInput[],
  seed: number,
): Promise<QuizQuestion[]> {
  const prompt = buildQuizGenerationPrompt(words.map(toPromptWord));

  const ATTEMPTS = 2;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let raw: string;
    try {
      raw = await withTimeout(
        provider.complete(prompt),
        AI_GENERATION_TIMEOUT_MS,
      );
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      continue;
    }

    const parsed = parseAiQuiz(raw);
    if (!parsed.ok) continue;

    const questions = buildAiQuizQuestions({
      items: parsed.value.items,
      words,
      seed,
    });
    if (questions.length > 0) return questions;
  }

  throw new Error(AI_QUIZ_FAILED_MESSAGE);
}

/** Builds the AI questions and opens the quiz (`em_andamento`) atomically. */
async function openQuiz(
  deps: QuizDeps,
  args: {
    readonly type: ExamType;
    readonly practiceOfId?: string | null;
    readonly selected: readonly Word[];
    readonly opts: QuizOptions;
    readonly now: Date;
  },
): Promise<Exam> {
  if (!args.opts.ai) throw new Error(NO_AI_PROVIDER_MESSAGE);

  const inputs: QuizWordInput[] = [];
  for (const word of args.selected) {
    inputs.push(await withContextSentences(deps.sightings, word));
  }
  const questions = await generateQuizWithAi(
    args.opts.ai,
    inputs,
    args.opts.seed,
  );

  return deps.exams.createQuiz({
    type: args.type,
    practiceOfId: args.practiceOfId ?? null,
    questions,
    createdAt: args.now,
  });
}

/**
 * Opens (or resumes) the weekly quiz: everything captured in the last 7 days,
 * one question per word. An open quiz of the same type is returned as-is so a
 * closed app or a stale tab never duplicates an exam.
 */
export async function startWeeklyQuiz(
  deps: QuizDeps,
  opts: QuizOptions,
  now: Date,
): Promise<Exam> {
  const inProgress = await deps.exams.findInProgressByType("semanal");
  if (inProgress) return inProgress;

  const all = await deps.words.listAll();
  const selected = selectWeeklyWords(all, now);
  if (selected.length === 0) {
    throw new Error(
      "Nenhuma palavra capturada na última semana — capture palavras antes de gerar o quiz semanal.",
    );
  }
  return openQuiz(deps, { type: "semanal", selected, opts, now });
}

/**
 * Opens (or resumes) the vocabulary quiz: a capped, weighted sample of the
 * whole glossary that favours struggling words (see selectVocabularyWords).
 */
export async function startVocabularyQuiz(
  deps: QuizDeps,
  opts: QuizOptions,
  now: Date,
): Promise<Exam> {
  const inProgress = await deps.exams.findInProgressByType("vocabulario");
  if (inProgress) return inProgress;

  const all = await deps.words.listAll();
  if (all.length === 0) {
    throw new Error(
      "Glossário vazio — capture palavras antes de gerar a prova de vocabulário.",
    );
  }
  const selected = selectVocabularyWords(all, now, createRng(opts.seed));
  return openQuiz(deps, { type: "vocabulario", selected, opts, now });
}

/**
 * Opens a practice quiz re-testing ONLY the words missed in a finished quiz.
 * The origin must be `finalizada`; the AI writes fresh questions for the
 * missed words, so practice never repeats the exact same question.
 */
export async function startPracticeQuiz(
  deps: QuizDeps,
  sourceExamId: string,
  opts: QuizOptions,
  now: Date,
): Promise<Exam> {
  const origin = await deps.exams.findById(sourceExamId);
  if (!origin) throw new Error(`Prova inexistente: ${sourceExamId}`);
  if (origin.status !== "finalizada") {
    throw new Error("Só é possível praticar os erros de uma prova finalizada.");
  }

  const originQuestions = await deps.exams.listQuestions(sourceExamId);
  const missedWordIds = new Set(
    originQuestions.filter((q) => q.isCorrect === false).map((q) => q.wordId),
  );
  if (missedWordIds.size === 0) {
    throw new Error("Nenhum erro para praticar.");
  }

  const all = await deps.words.listAll();
  const selected = all.filter((w) => missedWordIds.has(w.id));
  return openQuiz(deps, {
    type: "pratica",
    practiceOfId: sourceExamId,
    selected,
    opts,
    now,
  });
}

/** The correct answer as shown to the user after answering. */
function displayCorrectAnswer(question: ExamQuestion): string {
  if (question.options !== null && question.correctIndex !== null) {
    return question.options[question.correctIndex] ?? "";
  }
  return question.correctAnswer ?? "";
}

/**
 * Grades and persists one answer. The question must belong to the exam and
 * still be unanswered; grading happens here, server-side, so the answer key
 * never travels to the client beforehand.
 */
export async function answerQuizQuestion(
  deps: QuizDeps,
  input: AnswerQuizInput,
  now: Date,
): Promise<AnswerFeedback> {
  const question = await deps.exams.findQuestionById(input.questionId);
  if (!question || question.examId !== input.examId) {
    throw new Error("Questão não pertence a esta prova.");
  }
  if (question.answeredAt !== null) {
    throw new Error("Questão já respondida.");
  }

  // Legacy cloze questions (retired generator): the gap holds an inflected
  // surface form, but grading also accepts the headword itself.
  const term =
    question.type === "cloze"
      ? ((await deps.words.findById(question.wordId))?.term ?? null)
      : null;
  const isCorrect = gradeAnswer({ ...question, term }, input.answer);
  await deps.exams.answerQuestion(question.id, {
    userAnswer: input.answer,
    isCorrect,
    answeredAt: now,
  });

  const questions = await deps.exams.listQuestions(input.examId);
  return {
    isCorrect,
    correctAnswer: displayCorrectAnswer(question),
    contextSentence: question.contextSentence,
    explanation: question.explanation,
    answered: questions.filter((q) => q.answeredAt !== null).length,
    total: questions.length,
  };
}

/**
 * Closes a quiz: requires every question answered, computes the score itself
 * (never trusts an AI), maps each answer to an SM-2 review (pass = 5, fail =
 * 2) and persists score + ExamWord + SRS + ReviewLog in the repository's
 * all-or-nothing transaction. A second close is rejected by that transaction.
 */
export async function finishQuiz(
  deps: QuizDeps,
  examId: string,
  now: Date,
): Promise<Exam> {
  const questions = await deps.exams.listQuestions(examId);
  if (questions.length === 0) {
    throw new Error(`Prova inexistente ou sem questões: ${examId}`);
  }
  if (questions.some((q) => q.answeredAt === null)) {
    throw new Error("Ainda há questões sem resposta.");
  }

  const corrections: WordCorrection[] = [];
  for (const question of questions) {
    const word = await deps.words.findById(question.wordId);
    if (!word) continue; // never invent SRS data for a missing word
    const correct = question.isCorrect === true;
    const quality = srsQualityForAnswer(correct);
    const srs = reviewWord(word, quality, now);
    corrections.push({
      wordId: word.id,
      correct,
      srs: {
        easeFactor: srs.easeFactor,
        intervalDays: srs.intervalDays,
        repetitions: srs.repetitions,
        nextReview: srs.nextReview,
      },
      reviewLog: { quality, reviewedAt: now },
    });
  }

  const score = computeScore(questions.map((q) => q.isCorrect === true));
  return deps.exams.finishQuiz(examId, {
    score,
    finishedAt: now,
    words: corrections,
  });
}
