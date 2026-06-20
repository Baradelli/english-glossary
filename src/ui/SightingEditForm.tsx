"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { type ReactNode } from "react";
import { z } from "zod";
import { updateSightingAction } from "../server/actions.js";
import { SubmitButton, inputClass, labelClass } from "./controls.js";
import { notify } from "./lib/form.js";

const schema = z.object({
  contextSentence: z.string(),
  definitionEn: z.string(),
  definitionPt: z.string(),
  examples: z.string(),
});
type Values = z.infer<typeof schema>;

/**
 * Edits the source-specific meaning of a sighting (separate from the word's
 * general definition): context sentence, EN/PT definitions and examples.
 */
export function SightingEditForm({
  sightingId,
  defaultValues,
}: {
  sightingId: string;
  defaultValues: Values;
}): ReactNode {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues });

  async function onSubmit(values: Values): Promise<void> {
    const fd = new FormData();
    fd.set("sightingId", sightingId);
    fd.set("contextSentence", values.contextSentence);
    fd.set("definitionEn", values.definitionEn);
    fd.set("definitionPt", values.definitionPt);
    fd.set("examples", values.examples);
    if (notify(await updateSightingAction(fd))) router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label className={labelClass} htmlFor="contextSentence">
          Frase de contexto (a frase real desta fonte)
        </label>
        <input
          id="contextSentence"
          className={inputClass}
          {...register("contextSentence")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="definitionEn">
            Definição nesta fonte (EN)
          </label>
          <input
            id="definitionEn"
            className={inputClass}
            {...register("definitionEn")}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="definitionPt">
            Definição nesta fonte (PT)
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
          Exemplos específicos desta fonte (um por linha)
        </label>
        <textarea
          id="examples"
          rows={3}
          className={inputClass}
          {...register("examples")}
        />
      </div>

      <SubmitButton pending={isSubmitting}>Salvar</SubmitButton>
    </form>
  );
}
