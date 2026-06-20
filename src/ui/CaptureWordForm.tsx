"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { type ReactNode } from "react";
import { z } from "zod";
import { captureWordAction } from "../server/actions.js";
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

/**
 * Batch-capture form for a source page (React Hook Form + Zod). A re-encounter
 * needs only the term; a new word needs definitions and an example (validated
 * server-side). Values are held in RHF, so a server error leaves everything the
 * user typed in place; the form only clears after a successful capture.
 */
export function CaptureWordForm({ sourceId }: { sourceId: string }): ReactNode {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
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
      reset(empty); // clears only on success
      router.refresh(); // reflect the new word in the source's lists
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
