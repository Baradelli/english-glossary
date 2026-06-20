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
} from "../application/index.js";
import { captureDeps, repos } from "./container.js";

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
