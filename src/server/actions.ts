"use server";

/**
 * Server Actions for the capture flow (Fluxo A). Each is a thin adapter: read
 * the form, inject the real clock, delegate to a tested use case, then
 * revalidate/redirect. Validation errors from the domain are caught and
 * returned as form state so the UI can show them inline.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  captureInSource,
  ensureSource,
  ensureSourceType,
  generateSourceComprehensionExam,
  generateVocabularyExam,
  generateWeeklyReviewExam,
  reviewWordById,
  submitExamAnswers,
  submitExamCorrection,
} from "../application/index.js";
import {
  captureDeps,
  examComprehensionDeps,
  examGenDeps,
  repos,
} from "./container.js";

export interface FormState {
  readonly error?: string;
  readonly ok?: boolean;
  readonly message?: string;
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

export async function createSourceTypeAction(
  _prev: FormState,
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
  _prev: FormState,
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
  redirect(`/sources/${id}`);
}

export async function captureWordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const sourceId = field(formData, "sourceId");
  const term = field(formData, "term");
  if (!sourceId) return { error: "Fonte ausente." };
  if (!term) return { error: "Informe a palavra." };

  const examples = field(formData, "examples")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  try {
    const { word, created } = await captureInSource(
      captureDeps,
      {
        sourceId,
        term,
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
        ? `"${word.term}" cadastrada nesta fonte.`
        : `Reencontro de "${word.term}" registrado.`,
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

// ── Fluxo C: exam cycle ────────────────────────────────────────────────────

export async function generateWeeklyExamAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  let id: string;
  try {
    id = (await generateWeeklyReviewExam(examGenDeps, new Date())).id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  redirect(`/exams/${id}`);
}

export async function generateVocabularyExamAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
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
  redirect(`/exams/${id}`);
}

export async function generateComprehensionExamAction(
  _prev: FormState,
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
  redirect(`/exams/${id}`);
}

export async function submitAnswersAction(
  _prev: FormState,
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
  _prev: FormState,
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
  _prev: FormState,
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
