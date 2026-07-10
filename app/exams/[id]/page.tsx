import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { repos } from "../../../src/server/container.js";
import { getAiProvider } from "../../../src/server/ai.js";
import { CopyBlock } from "../../../src/ui/CopyBlock.js";
import {
  AnswersForm,
  AutoCorrectForm,
  CorrectionForm,
} from "../../../src/ui/ExamForms.js";
import { QuizResultActions } from "../../../src/ui/QuizResultActions.js";
import { QuizRunner, type QuizQuestionVM } from "../../../src/ui/QuizRunner.js";
import { WordObservationForm } from "../../../src/ui/WordObservationForm.js";
import {
  buildObservationSeed,
  buildOptionReview,
} from "../../../src/ui/lib/quizReview.js";
import { cardClass } from "../../../src/ui/controls.js";
import type {
  Exam,
  ExamQuestion,
  ExamStatus,
  ExamType,
} from "../../../src/domain/index.js";

export const dynamic = "force-dynamic";

const typeLabel: Record<ExamType, string> = {
  semanal: "Revisão semanal",
  vocabulario: "Prova de vocabulário",
  compreensao: "Prova de compreensão",
  pratica: "Prática de erros",
};

const statusLabel: Record<ExamStatus, string> = {
  gerada: "gerada",
  respondida: "respondida",
  corrigida: "corrigida",
  em_andamento: "em andamento",
  finalizada: "finalizada",
};

const statusStyle: Record<ExamStatus, string> = {
  gerada: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  respondida: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  corrigida: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  em_andamento: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  finalizada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className={cardClass}>
      <h2 className="font-semibold">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** The user's answer as readable text (MC answers are stored as an index). */
function userAnswerText(question: ExamQuestion): string {
  if (question.userAnswer === null) return "—";
  if (question.options !== null) {
    const index = Number(question.userAnswer);
    return question.options[index] ?? question.userAnswer;
  }
  return question.userAnswer;
}

/** The answer key as readable text — only ever rendered on the server, after the quiz is closed. */
function correctAnswerText(question: ExamQuestion): string {
  if (question.options !== null && question.correctIndex !== null) {
    return question.options[question.correctIndex] ?? "";
  }
  return question.correctAnswer ?? "";
}

/** Server-rendered result of a finished quiz: score, per-question review, practice CTA. */
async function QuizResult({ exam }: { exam: Exam }): Promise<ReactNode> {
  const [questions, words] = await Promise.all([
    repos.exams.listQuestions(exam.id),
    repos.words.listAll(),
  ]);
  const termById = new Map(words.map((word) => [word.id, word.term]));
  const errorCount = questions.filter((q) => q.isCorrect === false).length;

  return (
    <>
      <section className={cardClass}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Resultado</h2>
          <span className="text-3xl font-bold">{exam.score ?? 0}/100</span>
        </div>
        {exam.practiceOfId ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Prática da prova{" "}
            <Link
              href={`/exams/${exam.practiceOfId}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              original
            </Link>
            .
          </p>
        ) : null}
        <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {questions.map((question) => {
            const correct = question.isCorrect === true;
            const term = termById.get(question.wordId);
            const optionReview = buildOptionReview(question);
            const observationSeed = buildObservationSeed(question);
            return (
              <li key={question.id} id={"question-" + question.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start gap-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
                    <span
                      className={
                        correct
                          ? "mt-0.5 text-emerald-600 dark:text-emerald-400"
                          : "mt-0.5 text-red-600 dark:text-red-400"
                      }
                    >
                      <span aria-hidden>{correct ? "✓" : "✗"}</span>
                      <span className="sr-only">
                        {correct ? "Acertou" : "Errou"}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {term ?? "(palavra removida)"}
                      </span>
                      <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">
                        {question.prompt}
                      </span>
                      <span className="mt-1 block text-sm">
                        Sua resposta:{" "}
                        <span className="font-medium">
                          {userAnswerText(question)}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                      Ver análise
                      <span
                        aria-hidden
                        className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      >
                        ▾
                      </span>
                    </span>
                  </summary>

                  <div className="pb-5 pl-8">
                    {question.contextSentence ? (
                      <p className="mb-4 text-sm italic text-slate-500 dark:text-slate-400">
                        Frase da fonte: “{question.contextSentence}”
                      </p>
                    ) : null}

                    {optionReview.length > 0 ? (
                      <ol className="space-y-2" aria-label="Análise das alternativas">
                        {optionReview.map((option, index) => (
                          <li
                            key={index}
                            className={
                              option.correct
                                ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950"
                                : option.selected
                                  ? "rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950"
                                  : "rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                            }
                          >
                            <div className="flex flex-wrap items-start gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {String.fromCharCode(65 + index)}
                              </span>
                              <span className="min-w-0 flex-1 text-sm font-medium">
                                {option.text}
                              </span>
                              <span
                                className={
                                  option.correct
                                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                                    : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }
                              >
                                {option.correct ? "Correta" : "Incorreta"}
                              </span>
                              {option.selected ? (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  Sua resposta
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {option.explanation ??
                                "Explicação individual indisponível nesta prova anterior."}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <p>
                          Sua resposta:{" "}
                          <span className="font-medium">
                            {userAnswerText(question)}
                          </span>
                        </p>
                        <p>
                          Resposta correta:{" "}
                          <span className="font-medium">
                            {correctAnswerText(question)}
                          </span>
                        </p>
                        {question.explanation ? (
                          <p className="text-slate-600 dark:text-slate-400">
                            {question.explanation}
                          </p>
                        ) : null}
                      </div>
                    )}

                    {term ? (
                      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold">
                            Guardar no glossário
                          </h3>
                          <Link
                            href={"/glossary/" + question.wordId}
                            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Abrir {term}
                          </Link>
                        </div>
                        <WordObservationForm
                          wordId={question.wordId}
                          examId={exam.id}
                          initialText={observationSeed}
                        />
                      </div>
                    ) : null}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      {errorCount > 0 ? (
        <QuizResultActions examId={exam.id} errorCount={errorCount} />
      ) : null}
    </>
  );
}

export default async function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const exam = await repos.exams.findById(id);
  if (!exam) notFound();

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {typeLabel[exam.type]}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[exam.status]}`}
          >
            {statusLabel[exam.status]}
          </span>
        </p>
        <h1 className="text-2xl font-bold">Prova</h1>
      </header>

      {exam.status === "em_andamento" ? (
        <InProgressQuiz examId={exam.id} />
      ) : exam.status === "finalizada" ? (
        <QuizResult exam={exam} />
      ) : (
        <LegacyExam exam={exam} />
      )}

      <Link href="/exams" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Voltar às provas
      </Link>
    </div>
  );
}

/** Strips the answer key before anything crosses to the client component. */
async function InProgressQuiz({ examId }: { examId: string }): Promise<ReactNode> {
  const questions = await repos.exams.listQuestions(examId);
  const vm: QuizQuestionVM[] = questions.map((q) => ({
    id: q.id,
    position: q.position,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    userAnswer: q.userAnswer,
    isCorrect: q.isCorrect,
  }));
  return <QuizRunner examId={examId} questions={vm} />;
}

/** The copy-paste exam cycle, untouched — old exams and comprehension still live here. */
async function LegacyExam({ exam }: { exam: Exam }): Promise<ReactNode> {
  const apiEnabled = (await getAiProvider()) !== null;

  return (
    <>
      {exam.status === "gerada" ? (
        <>
          <Step n={1} title="Cole este prompt na IA e responda na conversa">
            <CopyBlock text={exam.promptText} />
          </Step>
          <Step n={2} title="Cole aqui a prova com as suas respostas">
            <AnswersForm examId={exam.id} />
          </Step>
          {apiEnabled ? (
            <section className={cardClass}>
              <h2 className="font-semibold">Atalho — corrigir via API</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Modo API ativo: pule os passos manuais e deixe a IA corrigir.
              </p>
              <div className="mt-4">
                <AutoCorrectForm examId={exam.id} />
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {exam.status === "respondida" && exam.correctionPrompt ? (
        <>
          <Step n={3} title="Cole este prompt de correção na IA">
            <CopyBlock text={exam.correctionPrompt} />
          </Step>
          <Step n={4} title="Cole o JSON de correção devolvido pela IA">
            <CorrectionForm examId={exam.id} />
          </Step>
        </>
      ) : null}

      {exam.status === "corrigida" && exam.resultJson ? (
        <section className={cardClass}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Resultado</h2>
            <span className="text-2xl font-bold">{exam.resultJson.score}/100</span>
          </div>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {exam.resultJson.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 py-2">
                <span
                  className={
                    item.correct
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {item.correct ? "✓" : "✗"}
                </span>
                <span>
                  <span className="font-medium">{item.term}</span>
                  {item.note ? (
                    <span className="text-slate-500 dark:text-slate-400"> — {item.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {exam.resultJson.feedback}
          </p>
        </section>
      ) : null}
    </>
  );
}
