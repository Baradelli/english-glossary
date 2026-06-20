"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { type ReactNode } from "react";
import { z } from "zod";
import { updateWordAction } from "../server/actions.js";
import { FieldError, SubmitButton, inputClass, labelClass } from "./controls.js";
import { notify } from "./lib/form.js";

const schema = z.object({
  definitionEn: z.string().trim().min(1, "Informe a definição em inglês."),
  definitionPt: z.string().trim().min(1, "Informe a definição em português."),
  examples: z.string(),
});
type Values = z.infer<typeof schema>;

export function WordEditForm({
  wordId,
  defaultValues,
}: {
  wordId: string;
  defaultValues: Values;
}): ReactNode {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues });

  async function onSubmit(values: Values): Promise<void> {
    const fd = new FormData();
    fd.set("wordId", wordId);
    fd.set("definitionEn", values.definitionEn);
    fd.set("definitionPt", values.definitionPt);
    fd.set("examples", values.examples);
    const result = await updateWordAction(fd);
    if (notify(result) && result?.redirectTo) router.push(result.redirectTo);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          <FieldError message={errors.definitionEn?.message} />
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
          <FieldError message={errors.definitionPt?.message} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="examples">
          Frases de exemplo autorais (uma por linha)
        </label>
        <textarea
          id="examples"
          rows={3}
          className={inputClass}
          {...register("examples")}
        />
      </div>

      <SubmitButton pending={isSubmitting}>Salvar alterações</SubmitButton>
    </form>
  );
}
