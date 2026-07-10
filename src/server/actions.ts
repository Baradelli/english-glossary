"use server";

/**
 * Server Actions for all flows. Each is a thin adapter: read the form, inject
 * the real clock, delegate to a tested use case, then revalidate/redirect.
 * Called directly from React Hook Form submit handlers, so the signature is a
 * plain `(formData) => Promise<FormState>`; validation errors come back as
 * state (surfaced as a toast / inline message) and never corrupt data.
 */

import { revalidatePath } from "next/cache";
import {
  buildDefineExpressionPrompt,
  buildDefineWordPrompt,
  type WordKind,
} from "../domain/index.js";
import {
  addWordObservation,
  answerQuizQuestion,
  autoCorrectExam,
  captureInSource,
  defineWord,
  deleteSource,
  ensureSource,
  ensureSourceType,
  finishQuiz,
  generateSourceComprehensionExam,
  getEffectiveAiConfig,
  markOnboardingSeen,
  resetOnboarding,
  saveAiSettings,
  startPracticeQuiz,
  startVocabularyQuiz,
  startWeeklyQuiz,
  saveTheme,
  submitExamAnswers,
  submitExamCorrection,
  updateSighting,
  updateWord,
} from "../application/index.js";
import { DEFAULT_MODEL } from "../infra/ai/ApiAiProvider.js";
import { mapAiError } from "../infra/ai/errors.js";
import { testAiConnection } from "../infra/ai/testConnection.js";
import { replaceAll } from "../infra/backup/backup.js";
import { prisma } from "../infra/prisma/client.js";
import {
  captureDeps,
  examComprehensionDeps,
  quizDeps,
  repos,
} from "./container.js";
import { getAiProvider } from "./ai.js";

export interface FormState {
  readonly error?: string;
  readonly ok?: boolean;
  readonly message?: string;
  /** When set, the client navigates here on success. */
  readonly redirectTo?: string;
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

/** Reads the entry kind from a form, defaulting to "palavra" (ADR-005). */
function kindField(formData: FormData): WordKind {
  return field(formData, "kind") === "expressao" ? "expressao" : "palavra";
}

export async function createSourceTypeAction(
  formData: FormData,
): Promise<FormState> {
  const name = field(formData, "name");
  if (!name) return { error: "Informe o nome do tipo." };
  try {
    await ensureSourceType(repos.sourceTypes, name);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/sources");
  revalidatePath("/sources/new");
  return { ok: true, message: `Tipo "${name}" pronto.` };
}

export async function createSourceAction(
  formData: FormData,
): Promise<FormState> {
  const name = field(formData, "name");
  const url = field(formData, "url");
  const sourceTypeId = field(formData, "sourceTypeId");
  if (!name) return { error: "Informe o nome da fonte." };
  if (!sourceTypeId) return { error: "Escolha um tipo de fonte." };

  let id: string;
  try {
    const source = await ensureSource(repos.sources, {
      name,
      url: url || null,
      sourceTypeId,
    });
    id = source.id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/sources");
  return { ok: true, redirectTo: `/sources/${id}` };
}

export async function deleteSourceAction(
  formData: FormData,
): Promise<FormState> {
  const sourceId = field(formData, "sourceId");
  if (!sourceId) return { error: "Fonte ausente." };
  try {
    await deleteSource(repos.sources, sourceId);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/sources");
  return { ok: true, redirectTo: "/sources" };
}

export async function captureWordAction(
  formData: FormData,
): Promise<FormState> {
  const sourceId = field(formData, "sourceId");
  const term = field(formData, "term");
  const kind = kindField(formData);
  if (!sourceId) return { error: "Fonte ausente." };
  if (!term)
    return { error: kind === "expressao" ? "Informe a expressão." : "Informe a palavra." };

  const examples = field(formData, "examples")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const label = kind === "expressao" ? "Expressão" : "Palavra";
  try {
    const { word, created } = await captureInSource(
      captureDeps,
      {
        sourceId,
        term,
        kind,
        definitionEn: field(formData, "definitionEn"),
        definitionPt: field(formData, "definitionPt"),
        examples,
        contextSentence: field(formData, "contextSentence") || null,
      },
      new Date(),
    );
    revalidatePath(`/sources/${sourceId}`);
    return {
      ok: true,
      message: created
        ? `${label} "${word.term}" cadastrada nesta fonte.`
        : `Reencontro de "${word.term}" registrado.`,
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

// ── Fluxo A: edit word / edit sighting ──────────────────────────────────────

function linesField(formData: FormData, name: string): string[] {
  return field(formData, name)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function updateWordAction(
  formData: FormData,
): Promise<FormState> {
  const wordId = field(formData, "wordId");
  try {
    await updateWord(repos.words, wordId, {
      definitionEn: field(formData, "definitionEn"),
      definitionPt: field(formData, "definitionPt"),
      examples: linesField(formData, "examples"),
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath(`/glossary/${wordId}`);
  return { ok: true, redirectTo: `/glossary/${wordId}` };
}

export async function addWordObservationAction(
  formData: FormData,
): Promise<FormState> {
  const wordId = field(formData, "wordId");
  const text = field(formData, "text");
  const examId = field(formData, "examId");
  if (!wordId) return { error: "Palavra ausente." };

  try {
    await addWordObservation(repos.words, { wordId, text });
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath(`/glossary/${wordId}`);
  if (examId) revalidatePath(`/exams/${examId}`);
  return { ok: true, message: "Observação adicionada ao glossário." };
}

export async function updateSightingAction(
  formData: FormData,
): Promise<FormState> {
  const sightingId = field(formData, "sightingId");
  try {
    await updateSighting(repos.sightings, sightingId, {
      contextSentence: field(formData, "contextSentence") || null,
      definitionEn: field(formData, "definitionEn") || null,
      definitionPt: field(formData, "definitionPt") || null,
      examples: linesField(formData, "examples"),
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath(`/sightings/${sightingId}`);
  return { ok: true, message: "Encontro atualizado." };
}

// ── Fluxo A: AI-assisted definitions ───────────────────────────────────────

export interface DefinePromptResult {
  readonly ok?: boolean;
  readonly error?: string;
  readonly prompt?: string;
}

/** Returns the define prompt for the term, to copy into an AI manually. */
export async function getDefinePromptAction(
  term: string,
  contextSentence?: string,
  kind: WordKind = "palavra",
): Promise<DefinePromptResult> {
  const trimmed = term.trim();
  if (!trimmed) {
    return {
      error:
        kind === "expressao"
          ? "Informe a expressão primeiro."
          : "Informe a palavra primeiro.",
    };
  }
  const prompt =
    kind === "expressao"
      ? buildDefineExpressionPrompt(trimmed, contextSentence)
      : buildDefineWordPrompt(trimmed, contextSentence);
  return { ok: true, prompt };
}

export interface DefineResult {
  readonly ok?: boolean;
  readonly error?: string;
  readonly definitionEn?: string;
  readonly definitionPt?: string;
  readonly examples?: readonly string[];
}

/** Asks the API adapter for the term's EN/PT definitions (opt-in). */
export async function defineWordAction(
  term: string,
  contextSentence?: string,
  kind: WordKind = "palavra",
): Promise<DefineResult> {
  const provider = await getAiProvider();
  if (!provider) {
    return { error: "Modo API não configurado. Adicione sua chave de API em Configurações." };
  }
  const trimmed = term.trim();
  if (!trimmed) {
    return {
      error:
        kind === "expressao"
          ? "Informe a expressão primeiro."
          : "Informe a palavra primeiro.",
    };
  }
  try {
    const def = await defineWord(provider, trimmed, contextSentence, kind);
    return {
      ok: true,
      definitionEn: def.definitionEn,
      definitionPt: def.definitionPt,
      examples: def.examples,
    };
  } catch (error) {
    return { error: `Falha ao gerar definição: ${mapAiError(error)}` };
  }
}

// ── Fluxo C: AI-generated quiz (ADR-009) ────────────────────────────────────

/** Opens (or resumes) the weekly quiz and points the client at it. */
export async function startWeeklyQuizAction(): Promise<FormState> {
  let id: string;
  try {
    const ai = await getAiProvider();
    const exam = await startWeeklyQuiz(
      quizDeps,
      { seed: Date.now(), ai },
      new Date(),
    );
    id = exam.id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  return { ok: true, redirectTo: `/exams/${id}` };
}

/** Opens (or resumes) the vocabulary quiz and points the client at it. */
export async function startVocabularyQuizAction(): Promise<FormState> {
  let id: string;
  try {
    const ai = await getAiProvider();
    const exam = await startVocabularyQuiz(
      quizDeps,
      { seed: Date.now(), ai },
      new Date(),
    );
    id = exam.id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  return { ok: true, redirectTo: `/exams/${id}` };
}

/** Opens a practice quiz over the mistakes of a finished quiz. */
export async function startPracticeQuizAction(
  formData: FormData,
): Promise<FormState> {
  const examId = field(formData, "examId");
  if (!examId) return { error: "Prova ausente." };
  let id: string;
  try {
    const ai = await getAiProvider();
    const exam = await startPracticeQuiz(
      quizDeps,
      examId,
      { seed: Date.now(), ai },
      new Date(),
    );
    id = exam.id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  return { ok: true, redirectTo: `/exams/${id}` };
}

/** Post-answer feedback: what the client learns only AFTER answering. */
export interface AnswerQuestionState {
  readonly ok?: boolean;
  readonly error?: string;
  readonly isCorrect?: boolean;
  readonly correctAnswer?: string;
  readonly contextSentence?: string | null;
  /** Short PT explanation of the correct answer (AI questions). */
  readonly explanation?: string | null;
  /** Questions answered so far / total, for the progress bar. */
  readonly answered?: number;
  readonly total?: number;
}

/** Grades one quiz answer server-side and returns the rich feedback state. */
export async function answerQuestionAction(
  formData: FormData,
): Promise<AnswerQuestionState> {
  const examId = field(formData, "examId");
  const questionId = field(formData, "questionId");
  const answer = field(formData, "answer");
  if (!examId || !questionId) return { error: "Questão ausente." };
  try {
    const feedback = await answerQuizQuestion(
      quizDeps,
      { examId, questionId, answer },
      new Date(),
    );
    return { ok: true, ...feedback };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

/** Closes a quiz: computes the score and applies SRS + logs atomically. */
export async function finishQuizAction(
  formData: FormData,
): Promise<FormState> {
  const examId = field(formData, "examId");
  if (!examId) return { error: "Prova ausente." };
  try {
    await finishQuiz(quizDeps, examId, new Date());
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/exams");
  revalidatePath(`/exams/${examId}`);
  return { ok: true, message: "Prova finalizada e SRS atualizado." };
}

// ── Fluxo C: legacy copy-paste exam cycle (comprehension) ───────────────────

export async function generateComprehensionExamAction(
  formData: FormData,
): Promise<FormState> {
  const sourceId = field(formData, "sourceId");
  const transcript = field(formData, "transcript");
  if (!sourceId) return { error: "Fonte ausente." };
  let id: string;
  try {
    const exam = await generateSourceComprehensionExam(
      examComprehensionDeps,
      sourceId,
      transcript || undefined,
      new Date(),
    );
    id = exam.id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  return { ok: true, redirectTo: `/exams/${id}` };
}

export async function submitAnswersAction(
  formData: FormData,
): Promise<FormState> {
  const examId = field(formData, "examId");
  const answersText = field(formData, "answersText");
  if (!answersText) return { error: "Cole a prova com suas respostas." };
  try {
    await submitExamAnswers(repos.exams, examId, answersText);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath(`/exams/${examId}`);
  return { ok: true, message: "Prompt de correção gerado." };
}

export async function submitCorrectionAction(
  formData: FormData,
): Promise<FormState> {
  const examId = field(formData, "examId");
  const resultText = field(formData, "resultText");
  if (!resultText) return { error: "Cole o JSON de correção." };

  const result = await submitExamCorrection(
    { words: repos.words, exams: repos.exams },
    examId,
    resultText,
    new Date(),
  );
  if (!result.ok) return { error: result.error };

  revalidatePath(`/exams/${examId}`);
  const ignored = result.unmatchedTerms.length
    ? ` Termos ignorados (sem correspondência): ${result.unmatchedTerms.join(", ")}.`
    : "";
  return { ok: true, message: `Correção aplicada e SRS atualizado.${ignored}` };
}

// ── Fluxo C (opt-in): auto-correct via the API adapter (ADR-001) ────────────

export async function autoCorrectAction(
  formData: FormData,
): Promise<FormState> {
  const provider = await getAiProvider();
  if (!provider) {
    return { error: "Modo API não configurado. Adicione sua chave de API em Configurações." };
  }
  const examId = field(formData, "examId");
  const answersText = field(formData, "answersText");
  if (!answersText) return { error: "Cole a prova com suas respostas." };

  let result;
  try {
    result = await autoCorrectExam(
      { words: repos.words, exams: repos.exams },
      provider,
      examId,
      answersText,
      new Date(),
    );
  } catch (error) {
    return { error: `Falha ao chamar a IA: ${mapAiError(error)}` };
  }
  if (!result.ok) return { error: result.error };

  revalidatePath(`/exams/${examId}`);
  return { ok: true, message: "Corrigido automaticamente via API." };
}

// ── Settings: save AI settings ──────────────────────────────────────────────

/**
 * Saves the AI key/model form. REGRA CRÍTICA (contrato da Task 2): when
 * `clearKey` is set, `apiKey` is forced to "" before reaching {@link
 * saveAiSettings} — that use case validates the whole input before branching,
 * so a stray non-empty apiKey alongside clearKey would otherwise fail
 * validation (or, worse, be silently ignored) instead of clearing the key.
 */
export async function saveAiSettingsAction(
  formData: FormData,
): Promise<FormState> {
  const clearKey = field(formData, "clearKey") === "true";
  const apiKey = clearKey ? "" : field(formData, "apiKey");
  const model = field(formData, "model");

  const result = await saveAiSettings(repos.settings, { apiKey, model, clearKey });
  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  return { ok: true, message: "Configurações de IA salvas." };
}

// ── Settings: AI connection test ────────────────────────────────────────────

/**
 * Cheap "test connection" for the Settings screen. Falls back to the stored
 * (or env) config for whichever field the user left blank, so the button
 * works both for a freshly typed key/model and for confirming what's already
 * saved.
 */
export async function testAiConnectionAction(
  formData: FormData,
): Promise<FormState> {
  const formApiKey = field(formData, "apiKey");
  const formModel = field(formData, "model");

  const effective = await getEffectiveAiConfig(repos.settings, {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL,
  });

  const apiKey = formApiKey || effective.apiKey;
  if (!apiKey) return { error: "Nenhuma chave de API para testar." };

  const model = formModel || effective.model || DEFAULT_MODEL;

  const result = await testAiConnection({ apiKey, model });
  if (!result.ok) return { error: result.error };
  return { ok: true, message: "Conexão OK — a chave e o modelo funcionam." };
}

// ── Settings: restore backup (replace all study data) ───────────────────────

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

/**
 * Restores an uploaded JSON backup, REPLACING all study data. Validation
 * happens before any wipe (inside {@link replaceAll}), so a bad file leaves the
 * database intact. On success every route is revalidated. The `Setting` table
 * (API key, etc.) is not part of the backup and survives the restore.
 */
export async function restoreBackupAction(
  formData: FormData,
): Promise<FormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo de backup." };
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return { error: "Arquivo muito grande (máx. 50 MB)." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { error: "O arquivo não é um JSON válido." };
  }

  const result = await replaceAll(prisma, parsed);
  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  return { ok: true, message: "Backup restaurado." };
}

// ── Settings: theme ──────────────────────────────────────────────────────────

/**
 * Saves the theme choice ("light" | "dark" | "system"). The layout applies it
 * server-side (`getSettingsView(repos.settings)`), so `revalidatePath("/",
 * "layout")` is enough — no cookie, no localStorage. The toggle applies the
 * change optimistically on the client before this round trip resolves; this
 * action just makes it durable.
 */
export async function saveThemeAction(formData: FormData): Promise<FormState> {
  const theme = field(formData, "theme");
  const result = await saveTheme(repos.settings, theme);
  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Onboarding: driver.js tour on the dashboard ─────────────────────────────

/**
 * Marks the onboarding tour as seen. Silent by design — called from every
 * tour exit path (Concluir, Pular, "x"), so there is no toast to show.
 */
export async function markOnboardingSeenAction(): Promise<FormState> {
  await markOnboardingSeen(repos.settings);
  revalidatePath("/");
  return { ok: true };
}

/** "Rever tour de boas-vindas" in Configurações: clears the seen flag and sends the user back to the Painel, where it auto-starts. */
export async function resetOnboardingAction(): Promise<FormState> {
  await resetOnboarding(repos.settings);
  revalidatePath("/");
  return { ok: true, redirectTo: "/" };
}
