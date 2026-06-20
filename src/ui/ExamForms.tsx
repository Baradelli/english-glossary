"use client";

import { useActionState, type ReactNode } from "react";
import {
  generateComprehensionExamAction,
  generateVocabularyExamAction,
  generateWeeklyExamAction,
  submitAnswersAction,
  submitCorrectionAction,
  type FormState,
} from "../server/actions.js";
import { FormMessage, SubmitButton, inputClass } from "./controls.js";

const initial: FormState = {};

export function GenerateExamButtons(): ReactNode {
  const [weekly, weeklyAction] = useActionState(generateWeeklyExamAction, initial);
  const [vocab, vocabAction] = useActionState(generateVocabularyExamAction, initial);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <form action={weeklyAction}>
          <SubmitButton pendingLabel="Gerando…">Revisão semanal</SubmitButton>
        </form>
        <form action={vocabAction}>
          <SubmitButton pendingLabel="Gerando…">
            Prova de vocabulário (glossário)
          </SubmitButton>
        </form>
      </div>
      <FormMessage state={weekly} />
      <FormMessage state={vocab} />
    </div>
  );
}

export function GenerateComprehensionForm({
  sourceId,
}: {
  sourceId: string;
}): ReactNode {
  const [state, action] = useActionState(
    generateComprehensionExamAction,
    initial,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sourceId" value={sourceId} />
      <textarea
        name="transcript"
        rows={3}
        placeholder="Transcrição/resumo da fonte (opcional, mas deixa a prova bem melhor)…"
        className={inputClass}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Gerando…">Gerar prova de compreensão</SubmitButton>
    </form>
  );
}

export function AnswersForm({ examId }: { examId: string }): ReactNode {
  const [state, action] = useActionState(submitAnswersAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="examId" value={examId} />
      <textarea
        name="answersText"
        rows={8}
        required
        placeholder="Cole aqui a prova com as suas respostas (como ficou na conversa com a IA)…"
        className={inputClass}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Gerando correção…">
        Gerar prompt de correção
      </SubmitButton>
    </form>
  );
}

export function CorrectionForm({ examId }: { examId: string }): ReactNode {
  const [state, action] = useActionState(submitCorrectionAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="examId" value={examId} />
      <textarea
        name="resultText"
        rows={8}
        required
        placeholder='Cole o JSON de correção devolvido pela IA: {"score":…,"items":[…],"feedback":"…"}'
        className={`${inputClass} font-mono`}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Validando…">
        Validar e atualizar SRS
      </SubmitButton>
    </form>
  );
}
