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
  kind: z.enum(["palavra", "expressao"]),
  term: z.string().trim().min(1, "Informe o termo."),
  definitionEn: z.string(),
  definitionPt: z.string(),
  examples: z.string(),
  contextSentence: z.string(),
});
type Values = z.infer<typeof schema>;

const empty: Values = {
  kind: "palavra",
  term: "",
  definitionEn: "",
  definitionPt: "",
  examples: "",
  contextSentence: "",
};

const KIND_OPTIONS = [
  { value: "palavra", label: "Palavra" },
  { value: "expressao", label: "Expressão" },
] as const;

const helperButtonClass =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";

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
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty });

  const kind = watch("kind");
  const isExpr = kind === "expressao";
  const noun = isExpr ? "expressão" : "palavra";

  async function onSubmit(values: Values): Promise<void> {
    const fd = new FormData();
    fd.set("sourceId", sourceId);
    fd.set("kind", values.kind);
    fd.set("term", values.term);
    fd.set("definitionEn", values.definitionEn);
    fd.set("definitionPt", values.definitionPt);
    fd.set("examples", values.examples);
    fd.set("contextSentence", values.contextSentence);

    const result = await captureWordAction(fd);
    if (notify(result)) {
      reset({ ...empty, kind: values.kind });
      router.refresh();
    }
  }

  async function copyPrompt(): Promise<void> {
    const term = getValues("term").trim();
    if (!term) return void toast.error(`Informe a ${noun} primeiro.`);
    const context = getValues("contextSentence").trim();
    const result = await getDefinePromptAction(term, context || undefined, kind);
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
    if (!term) return void toast.error(`Informe a ${noun} primeiro.`);
    const context = getValues("contextSentence").trim();
    setDefining(true);
    const result = await defineWordAction(term, context || undefined, kind);
    setDefining(false);
    if (result.definitionEn && result.definitionPt) {
      setValue("definitionEn", result.definitionEn);
      setValue("definitionPt", result.definitionPt);
      if (result.examples?.length) {
        setValue("examples", result.examples.join("\n"));
      }
      toast.success("Definições preenchidas. Revise antes de capturar.");
    } else {
      toast.error(result.error ?? "Erro ao gerar definição.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div
        role="radiogroup"
        aria-label="Tipo de entrada"
        className="inline-flex gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800"
      >
        {KIND_OPTIONS.map((opt) => {
          const selected = kind === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setValue("kind", opt.value)}
              className={
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors " +
                (selected
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div>
        <label className={labelClass} htmlFor="term">
          {isExpr ? "Expressão" : "Palavra"}
        </label>
        <input
          id="term"
          className={inputClass}
          placeholder={isExpr ? "ex.: break a leg" : undefined}
          {...register("term")}
        />
        <FieldError message={errors.term?.message} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {isExpr
            ? "A expressão idiomática completa, como se diz em inglês."
            : "Se já existir, registramos um reencontro. Formas flexionadas são entradas distintas (ex.: “ramble” e “rambling”)."}
        </p>
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
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          A frase real onde você encontrou {isExpr ? "a expressão" : "a palavra"}.
          É usada para gerar a definição no contexto certo.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Não sabe a definição? Gere a partir {isExpr ? "da expressão" : "da palavra"} e
          do contexto:
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
          <textarea
            id="definitionEn"
            rows={3}
            className={inputClass}
            {...register("definitionEn")}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="definitionPt">
            Definição (PT)
          </label>
          <textarea
            id="definitionPt"
            rows={3}
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

      <SubmitButton pending={isSubmitting} pendingLabel="Capturando…">
        {isExpr ? "Capturar expressão" : "Capturar palavra"}
      </SubmitButton>
    </form>
  );
}
