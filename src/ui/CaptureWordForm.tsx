"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  captureWordAction,
  defineWordAction,
  getDefinePromptAction,
} from "../server/actions.js";
import { FieldError, SubmitButton, inputClass, labelClass } from "./controls.js";
import { notify } from "./lib/form.js";

const schema = z.object({
  term: z.string().trim().min(1, "Informe a palavra."),
  definitionEn: z.string(),
  definitionPt: z.string(),
  examples: z.string(),
  contextSentence: z.string(),
});
type Values = z.infer<typeof schema>;

const empty: Values = {
  term: "",
  definitionEn: "",
  definitionPt: "",
  examples: "",
  contextSentence: "",
};

const helperButtonClass =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Batch-capture form for a source page (React Hook Form + Zod). Values are held
 * in RHF, so a server error leaves everything in place; the form clears only on
 * success. Two helpers generate the EN/PT definitions for the typed word:
 * copy a prompt for any AI, or (when the API adapter is on) fill them directly.
 */
export function CaptureWordForm({
  sourceId,
  apiEnabled = false,
}: {
  sourceId: string;
  apiEnabled?: boolean;
}): ReactNode {
  const router = useRouter();
  const [defining, setDefining] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty });

  async function onSubmit(values: Values): Promise<void> {
    const fd = new FormData();
    fd.set("sourceId", sourceId);
    fd.set("term", values.term);
    fd.set("definitionEn", values.definitionEn);
    fd.set("definitionPt", values.definitionPt);
    fd.set("examples", values.examples);
    fd.set("contextSentence", values.contextSentence);

    const result = await captureWordAction(fd);
    if (notify(result)) {
      reset(empty);
      router.refresh();
    }
  }

  async function copyPrompt(): Promise<void> {
    const term = getValues("term").trim();
    if (!term) return void toast.error("Informe a palavra primeiro.");
    const result = await getDefinePromptAction(term);
    if (!result.prompt) return void toast.error(result.error ?? "Erro.");
    try {
      await navigator.clipboard.writeText(result.prompt);
      toast.success("Prompt de definição copiado.");
    } catch {
      toast.error("Não foi possível copiar para a área de transferência.");
    }
  }

  async function fillViaApi(): Promise<void> {
    const term = getValues("term").trim();
    if (!term) return void toast.error("Informe a palavra primeiro.");
    setDefining(true);
    const result = await defineWordAction(term);
    setDefining(false);
    if (result.definitionEn && result.definitionPt) {
      setValue("definitionEn", result.definitionEn);
      setValue("definitionPt", result.definitionPt);
      toast.success("Definições preenchidas. Revise antes de capturar.");
    } else {
      toast.error(result.error ?? "Erro ao gerar definição.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label className={labelClass} htmlFor="term">
          Palavra
        </label>
        <input id="term" className={inputClass} {...register("term")} />
        <FieldError message={errors.term?.message} />
        <p className="mt-1 text-xs text-slate-500">
          Se já existir, registramos um reencontro. Formas flexionadas são
          entradas distintas (ex.: “ramble” e “rambling”).
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-600">
          Não sabe a definição? Gere a partir da palavra:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyPrompt}
            className={helperButtonClass}
          >
            Copiar prompt de definição
          </button>
          {apiEnabled ? (
            <button
              type="button"
              onClick={fillViaApi}
              disabled={defining}
              className={helperButtonClass}
            >
              {defining ? "Definindo…" : "Preencher EN/PT via API"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="definitionEn">
            Definição (EN)
          </label>
          <input
            id="definitionEn"
            className={inputClass}
            {...register("definitionEn")}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="definitionPt">
            Definição (PT)
          </label>
          <input
            id="definitionPt"
            className={inputClass}
            {...register("definitionPt")}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="examples">
          Frases de exemplo autorais (uma por linha)
        </label>
        <textarea
          id="examples"
          rows={2}
          className={inputClass}
          {...register("examples")}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="contextSentence">
          Frase de contexto desta fonte (opcional)
        </label>
        <input
          id="contextSentence"
          className={inputClass}
          {...register("contextSentence")}
        />
      </div>

      <SubmitButton pending={isSubmitting} pendingLabel="Capturando…">
        Capturar palavra
      </SubmitButton>
    </form>
  );
}
