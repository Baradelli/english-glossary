"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { QuizQuestionType } from "../domain/index.js";
import {
  answerQuestionAction,
  finishQuizAction,
  type AnswerQuestionState,
  type FormState,
} from "../server/actions.js";
import { inputClass } from "./controls.js";
import { cn } from "./lib/cn.js";
import { notify } from "./lib/form.js";

/**
 * What the client is allowed to see BEFORE answering: no correctIndex, no
 * correctAnswer, no contextSentence — the answer key only ever arrives through
 * {@link answerQuestionAction}'s feedback, after the answer is persisted.
 */
export interface QuizQuestionVM {
  readonly id: string;
  readonly position: number;
  readonly type: QuizQuestionType;
  readonly prompt: string;
  readonly options: string[] | null;
  readonly userAnswer: string | null;
  readonly isCorrect: boolean | null;
}

interface Feedback {
  readonly isCorrect: boolean;
  readonly correctAnswer: string;
  readonly contextSentence: string | null;
  readonly explanation: string | null;
}

type Phase = "answering" | "feedback";

const primaryButtonClass =
  "inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-950";

function Kbd({ children }: { children: ReactNode }): ReactNode {
  return (
    <kbd className="rounded border border-slate-300 bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </kbd>
  );
}

/** First question the user still has to answer; length when all are done. */
function firstUnanswered(questions: readonly QuizQuestionVM[]): number {
  const index = questions.findIndex((q) => q.userAnswer === null);
  return index === -1 ? questions.length : index;
}

/**
 * Runs an in-progress quiz question by question (§ Fase 2). Answers are graded
 * server-side by {@link answerQuestionAction} — this component never holds the
 * answer key — and the final "Ver resultado" closes the exam through
 * {@link finishQuizAction}, after which the server re-renders the result page.
 */
export function QuizRunner({
  examId,
  questions,
}: {
  examId: string;
  questions: readonly QuizQuestionVM[];
}): ReactNode {
  const router = useRouter();
  // Resume where the user stopped: answers are always taken in order, so the
  // first unanswered question is the session's head.
  const [index, setIndex] = useState<number>(() => firstUnanswered(questions));
  const [phase, setPhase] = useState<Phase>("answering");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [answeredCount, setAnsweredCount] = useState<number>(
    () => questions.filter((q) => q.userAnswer !== null).length,
  );

  const total = questions.length;
  const question = questions[index] ?? null;
  const allAnswered = answeredCount >= total;

  async function submit(answer: string): Promise<void> {
    if (!question || pending || phase !== "answering") return;
    setPending(true);
    const fd = new FormData();
    fd.set("examId", examId);
    fd.set("questionId", question.id);
    fd.set("answer", answer);
    let result: AnswerQuestionState;
    try {
      result = await answerQuestionAction(fd);
    } catch {
      // Transport failure (server restart, offline): the promise rejects
      // before the action's own error handling ever runs.
      notify({ error: "Falha ao enviar a resposta. Verifique a conexão e tente novamente." });
      return;
    } finally {
      setPending(false);
    }
    if (!result.ok || result.isCorrect === undefined || result.correctAnswer === undefined) {
      notify({ error: result.error ?? "Não foi possível enviar a resposta." });
      return;
    }
    setAnsweredCount(result.answered ?? answeredCount + 1);
    setFeedback({
      isCorrect: result.isCorrect,
      correctAnswer: result.correctAnswer,
      contextSentence: result.contextSentence ?? null,
      explanation: result.explanation ?? null,
    });
    setPhase("feedback");
  }

  function goNext(): void {
    // Everything before `index` is already answered, so the next open
    // question is the first one after it without a stored answer.
    let next = index + 1;
    while (next < total && questions[next]?.userAnswer !== null) next += 1;
    setIndex(next);
    setPhase("answering");
    setFeedback(null);
    setSelected(null);
    setTyped("");
  }

  async function finish(): Promise<void> {
    if (pending) return;
    setPending(true);
    const fd = new FormData();
    fd.set("examId", examId);
    let result: FormState;
    try {
      result = await finishQuizAction(fd);
    } catch {
      notify({ error: "Falha ao finalizar a prova. Verifique a conexão e tente novamente." });
      return;
    } finally {
      setPending(false);
    }
    // The action revalidated the page; refreshing swaps in the server-rendered result.
    if (notify(result)) router.refresh();
  }

  // One keydown listener for every shortcut. No dependency array on purpose:
  // it re-subscribes each render so the handlers always see fresh state.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.repeat) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const tag = target?.tagName ?? "";
      // Inside the typed/cloze input, Enter submits through the form itself.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (phase === "answering" && question?.options) {
        if (event.key >= "1" && event.key <= "4") {
          const choice = Number(event.key) - 1;
          if (choice < question.options.length) {
            event.preventDefault();
            setSelected(choice);
          }
          return;
        }
        if (event.key === "Enter") {
          // The submit button and links already act on Enter — don't
          // double-fire. A focused ALTERNATIVE (mouse click leaves focus on
          // it) would only re-select itself, so honour the advertised
          // "Enter confirma" and submit the current selection instead.
          const isOption =
            tag === "BUTTON" && target?.dataset["quizOption"] !== undefined;
          if ((tag === "BUTTON" || tag === "A") && !isOption) return;
          if (selected !== null) {
            event.preventDefault();
            void submit(String(selected));
          }
          return;
        }
      }

      if (phase === "feedback" && event.key === "Enter") {
        if (tag === "BUTTON" || tag === "A") return;
        event.preventDefault();
        if (allAnswered) void finish();
        else goNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Resumed with everything already answered (app closed between the last
  // answer and "Ver resultado"): only the closing step is left.
  if (question === null) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Todas as questões respondidas</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Feche a prova para ver a nota e atualizar as revisões.
        </p>
        <button
          type="button"
          autoFocus
          disabled={pending}
          onClick={() => void finish()}
          className={cn(primaryButtonClass, "mt-5")}
        >
          {pending ? "Finalizando…" : "Ver resultado"}
        </button>
      </section>
    );
  }

  const isMultipleChoice = question.options !== null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Questão {Math.min(index + 1, total)} de {total}
        </p>
        <div
          role="progressbar"
          aria-label="Progresso da prova"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: total > 0 ? `${(answeredCount / total) * 100}%` : "0%" }}
          />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-lg font-medium">{question.prompt}</p>

        {isMultipleChoice && question.options ? (
          <div className="mt-4 space-y-2" role="group" aria-label="Alternativas">
            {question.options.slice(0, 4).map((option, i) => (
              <button
                key={i}
                type="button"
                data-quiz-option=""
                disabled={pending || phase === "feedback"}
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  selected === i
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-950"
                    : "border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                )}
              >
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {i + 1}
                </kbd>
                <span>{option}</span>
              </button>
            ))}
            {phase === "answering" ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    <Kbd>1</Kbd>–<Kbd>4</Kbd> seleciona
                  </span>
                  <span>
                    <Kbd>Enter</Kbd> confirma
                  </span>
                </p>
                <button
                  type="button"
                  disabled={pending || selected === null}
                  onClick={() => selected !== null && void submit(String(selected))}
                  className={primaryButtonClass}
                >
                  {pending ? "Enviando…" : "Responder"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (typed.trim()) void submit(typed);
            }}
            className="mt-4 space-y-3"
          >
            <input
              key={question.id}
              autoFocus
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={pending || phase === "feedback"}
              placeholder={
                question.type === "cloze"
                  ? "Digite a palavra que completa a frase…"
                  : "Digite a resposta…"
              }
              aria-label="Sua resposta"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
            {phase === "answering" ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <Kbd>Enter</Kbd> envia
                </p>
                <button
                  type="submit"
                  disabled={pending || typed.trim() === ""}
                  className={primaryButtonClass}
                >
                  {pending ? "Enviando…" : "Responder"}
                </button>
              </div>
            ) : null}
          </form>
        )}
      </section>

      {phase === "feedback" && feedback ? (
        <section
          role="status"
          className={cn(
            "rounded-lg border p-4",
            feedback.isCorrect
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
          )}
        >
          <p className="font-semibold">
            {feedback.isCorrect ? "Você acertou!" : "Não foi dessa vez."}
          </p>
          <p className="mt-1 text-sm">
            Resposta correta: <span className="font-medium">{feedback.correctAnswer}</span>
          </p>
          {feedback.explanation ? (
            <p className="mt-2 text-sm">{feedback.explanation}</p>
          ) : null}
          {feedback.contextSentence ? (
            <p className="mt-2 text-sm italic">
              Frase da fonte: “{feedback.contextSentence}”
            </p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs opacity-80">
              <Kbd>Enter</Kbd> {allAnswered ? "finaliza" : "avança"}
            </p>
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() => (allAnswered ? void finish() : goNext())}
              className={primaryButtonClass}
            >
              {pending
                ? "Finalizando…"
                : allAnswered
                  ? "Ver resultado"
                  : "Próxima questão"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
