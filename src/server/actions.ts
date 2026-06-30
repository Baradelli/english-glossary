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
  autoCorrectExam,
  captureInSource,
  defineWord,
  deleteSource,
  ensureSource,
  ensureSourceType,
  generateSourceComprehensionExam,
  generateVocabularyExam,
  generateWeeklyReviewExam,
  reviewWordById,
  submitExamAnswers,
  submitExamCorrection,
  updateSighting,
  updateWord,
} from "../application/index.js";
import {
  captureDeps,
  examComprehensionDeps,
  examGenDeps,
  repos,
} from "./container.js";
import { getAiProvider } from "../infra/ai/provider.js";

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
  const provider = getAiProvider();
  if (!provider) {
    return { error: "Modo API não configurado (defina ANTHROPIC_API_KEY)." };
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
    return { error: `Falha ao gerar definição: ${errorMessage(error)}` };
  }
}

// ── Fluxo C: exam cycle ────────────────────────────────────────────────────

export async function generateWeeklyExamAction(): Promise<FormState> {
  let id: string;
  try {
    id = (await generateWeeklyReviewExam(examGenDeps, new Date())).id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  return { ok: true, redirectTo: `/exams/${id}` };
}

export async function generateVocabularyExamAction(): Promise<FormState> {
  let id: string;
  try {
    const words = await repos.words.listAll();
    const exam = await generateVocabularyExam(
      examGenDeps,
      words.map((w) => w.id),
      new Date(),
    );
    id = exam.id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  return { ok: true, redirectTo: `/exams/${id}` };
}

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

// ── Fluxo B: review ────────────────────────────────────────────────────────

export async function reviewWordAction(
  formData: FormData,
): Promise<FormState> {
  const wordId = field(formData, "wordId");
  const quality = Number.parseInt(field(formData, "quality"), 10);
  try {
    await reviewWordById({ words: repos.words }, { wordId, quality }, new Date());
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/review");
  return { ok: true };
}

// ── Fluxo C (opt-in): auto-correct via the API adapter (ADR-001) ────────────

export async function autoCorrectAction(
  formData: FormData,
): Promise<FormState> {
  const provider = getAiProvider();
  if (!provider) {
    return { error: "Modo API não configurado (defina ANTHROPIC_API_KEY)." };
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
    return { error: `Falha ao chamar a IA: ${errorMessage(error)}` };
  }
  if (!result.ok) return { error: result.error };

  revalidatePath(`/exams/${examId}`);
  return { ok: true, message: "Corrigido automaticamente via API." };
}
