"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import {
  autoCorrectAction,
  generateComprehensionExamAction,
  startVocabularyQuizAction,
  startWeeklyQuizAction,
  submitAnswersAction,
  submitCorrectionAction,
  type FormState,
} from "../server/actions.js";
import { FieldError, SubmitButton, inputClass } from "./controls.js";
import { notify } from "./lib/form.js";

const buttonClass =
  "inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

export function GenerateExamButtons({
  disabled = false,
}: {
  disabled?: boolean;
}): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState<null | "weekly" | "vocab">(null);

  async function run(
    kind: "weekly" | "vocab",
    action: () => Promise<FormState>,
  ): Promise<void> {
    setPending(kind);
    const result = await action();
    setPending(null);
    if (notify(result) && result?.redirectTo) router.push(result.redirectTo);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled || pending !== null}
          onClick={() => run("weekly", startWeeklyQuizAction)}
          className={buttonClass}
        >
          {pending === "weekly" ? "Gerando prova…" : "Revisão semanal"}
        </button>
        <button
          type="button"
          disabled={disabled || pending !== null}
          onClick={() => run("vocab", startVocabularyQuizAction)}
          className={buttonClass}
        >
          {pending === "vocab" ? "Gerando prova…" : "Prova de vocabulário"}
        </button>
      </div>
      {pending !== null ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          A IA está montando as questões — isso pode levar alguns segundos.
        </p>
      ) : null}
    </div>
  );
}

const comprehensionSchema = z.object({ transcript: z.string() });
type ComprehensionValues = z.infer<typeof comprehensionSchema>;

export function GenerateComprehensionForm({
  sourceId,
}: {
  sourceId: string;
}): ReactNode {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ComprehensionValues>({
    resolver: zodResolver(comprehensionSchema),
    defaultValues: { transcript: "" },
  });

  async function onSubmit(values: ComprehensionValues): Promise<void> {
    const fd = new FormData();
    fd.set("sourceId", sourceId);
    fd.set("transcript", values.transcript);
    const result = await generateComprehensionExamAction(fd);
    if (notify(result) && result?.redirectTo) router.push(result.redirectTo);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <textarea
        rows={3}
        placeholder="Transcrição/resumo da fonte (opcional, mas deixa a prova bem melhor)…"
        className={inputClass}
        {...register("transcript")}
      />
      <SubmitButton pending={isSubmitting} pendingLabel="Gerando…">
        Gerar prova de compreensão
      </SubmitButton>
    </form>
  );
}

const answersSchema = z.object({
  answersText: z.string().trim().min(1, "Cole a prova com suas respostas."),
});
type AnswersValues = z.infer<typeof answersSchema>;

export function AnswersForm({ examId }: { examId: string }): ReactNode {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AnswersValues>({
    resolver: zodResolver(answersSchema),
    defaultValues: { answersText: "" },
  });

  async function onSubmit(values: AnswersValues): Promise<void> {
    const fd = new FormData();
    fd.set("examId", examId);
    fd.set("answersText", values.answersText);
    if (notify(await submitAnswersAction(fd))) router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <textarea
        rows={8}
        placeholder="Cole aqui a prova com as suas respostas (como ficou na conversa com a IA)…"
        className={inputClass}
        {...register("answersText")}
      />
      <FieldError message={errors.answersText?.message} />
      <SubmitButton pending={isSubmitting} pendingLabel="Gerando correção…">
        Gerar prompt de correção
      </SubmitButton>
    </form>
  );
}

const autoSchema = z.object({
  answersText: z.string().trim().min(1, "Cole a prova com suas respostas."),
});
type AutoValues = z.infer<typeof autoSchema>;

export function AutoCorrectForm({ examId }: { examId: string }): ReactNode {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AutoValues>({
    resolver: zodResolver(autoSchema),
    defaultValues: { answersText: "" },
  });

  async function onSubmit(values: AutoValues): Promise<void> {
    const fd = new FormData();
    fd.set("examId", examId);
    fd.set("answersText", values.answersText);
    if (notify(await autoCorrectAction(fd))) router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <textarea
        rows={6}
        placeholder="Cole a prova com suas respostas; a IA corrige automaticamente via API…"
        className={inputClass}
        {...register("answersText")}
      />
      <FieldError message={errors.answersText?.message} />
      <SubmitButton pending={isSubmitting} pendingLabel="Corrigindo via API…">
        Responder e corrigir via API
      </SubmitButton>
    </form>
  );
}

const correctionSchema = z.object({
  resultText: z.string().trim().min(1, "Cole o JSON de correção."),
});
type CorrectionValues = z.infer<typeof correctionSchema>;

export function CorrectionForm({ examId }: { examId: string }): ReactNode {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CorrectionValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { resultText: "" },
  });

  async function onSubmit(values: CorrectionValues): Promise<void> {
    const fd = new FormData();
    fd.set("examId", examId);
    fd.set("resultText", values.resultText);
    if (notify(await submitCorrectionAction(fd))) router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <textarea
        rows={8}
        placeholder='Cole o JSON de correção devolvido pela IA: {"score":…,"items":[…],"feedback":"…"}'
        className={`${inputClass} font-mono`}
        {...register("resultText")}
      />
      <FieldError message={errors.resultText?.message} />
      <SubmitButton pending={isSubmitting} pendingLabel="Validando…">
        Validar e atualizar SRS
      </SubmitButton>
    </form>
  );
}
