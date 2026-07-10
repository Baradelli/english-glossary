"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  addWordObservationAction,
  type FormState,
} from "../server/actions.js";
import { FieldError, SubmitButton, inputClass, labelClass } from "./controls.js";
import { notify } from "./lib/form.js";

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Escreva a observação.")
    .max(2_000, "Use no máximo 2.000 caracteres."),
});

type Values = z.infer<typeof schema>;

export function WordObservationForm({
  wordId,
  examId,
  initialText = "",
}: {
  wordId: string;
  examId?: string;
  initialText?: string;
}): ReactNode {
  const router = useRouter();
  const fieldId = useId();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { text: initialText },
  });

  async function onSubmit(values: Values): Promise<void> {
    const formData = new FormData();
    formData.set("wordId", wordId);
    formData.set("text", values.text);
    if (examId) formData.set("examId", examId);

    let result: FormState;
    try {
      result = await addWordObservationAction(formData);
    } catch {
      notify({ error: "Não foi possível salvar a observação." });
      return;
    }
    if (notify(result)) {
      reset({ text: "" });
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2" noValidate>
      <label className={labelClass} htmlFor={fieldId}>
        Nova observação
      </label>
      <textarea
        id={fieldId}
        rows={3}
        placeholder="Uso, nuance, associação ou contexto que você quer lembrar…"
        className={inputClass}
        {...register("text")}
      />
      <FieldError message={errors.text?.message} />
      <SubmitButton pending={isSubmitting} pendingLabel="Salvando…">
        Adicionar observação
      </SubmitButton>
    </form>
  );
}
