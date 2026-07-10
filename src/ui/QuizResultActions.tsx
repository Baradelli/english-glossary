"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  startPracticeQuizAction,
  type FormState,
} from "../server/actions.js";
import { notify } from "./lib/form.js";

/**
 * Follow-up actions of a finished quiz. "Praticar erros" opens a practice
 * quiz over the questions the user got wrong and navigates straight into it.
 */
export function QuizResultActions({
  examId,
  errorCount,
}: {
  examId: string;
  errorCount: number;
}): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function practice(): Promise<void> {
    if (pending) return;
    setPending(true);
    const fd = new FormData();
    fd.set("examId", examId);
    let result: FormState;
    try {
      result = await startPracticeQuizAction(fd);
    } catch {
      // Transport failure: the action never got a chance to answer.
      notify({ error: "Falha ao criar a prova de prática. Verifique a conexão e tente novamente." });
      return;
    } finally {
      setPending(false);
    }
    if (notify(result) && result.redirectTo) router.push(result.redirectTo);
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void practice()}
      className={
        "inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
        "disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-950"
      }
    >
      {pending ? "Gerando…" : `Praticar erros (${errorCount})`}
    </button>
  );
}
