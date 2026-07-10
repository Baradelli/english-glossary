import type { ReactNode } from "react";
import Link from "next/link";
import { repos } from "../../src/server/container.js";
import { getAiProvider } from "../../src/server/ai.js";
import { GenerateExamButtons } from "../../src/ui/ExamForms.js";
import { cardClass } from "../../src/ui/controls.js";
import type { ExamStatus, ExamType } from "../../src/domain/index.js";

export const dynamic = "force-dynamic";

const typeLabel: Record<ExamType, string> = {
  semanal: "Revisão semanal",
  vocabulario: "Vocabulário",
  compreensao: "Compreensão",
  pratica: "Prática",
};

const statusStyle: Record<ExamStatus, string> = {
  gerada: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  respondida: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  corrigida: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  em_andamento: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  finalizada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const statusLabel: Record<ExamStatus, string> = {
  gerada: "gerada",
  respondida: "respondida",
  corrigida: "corrigida",
  em_andamento: "em andamento",
  finalizada: "finalizada",
};

export default async function ExamsPage(): Promise<ReactNode> {
  const [exams, apiEnabled] = await Promise.all([
    repos.exams.listAll(),
    getAiProvider().then((p) => p !== null),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Provas</h1>

      <section className={cardClass}>
        <h2 className="font-semibold">Gerar prova</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          A IA monta as questões de múltipla escolha a partir do seu glossário;
          o app corrige questão a questão. A prova de compreensão de uma fonte
          continua sendo gerada pela página da fonte.
        </p>
        {apiEnabled ? null : (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Para gerar provas, configure sua chave de API em{" "}
            <Link href="/settings" className="font-medium underline">
              Configurações
            </Link>
            .
          </p>
        )}
        <div className="mt-4">
          <GenerateExamButtons disabled={!apiEnabled} />
        </div>
      </section>

      <section>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {exams.map((exam) => (
            <li key={exam.id}>
              <Link
                href={`/exams/${exam.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="font-medium">{typeLabel[exam.type]}</span>
                <span className="flex items-center gap-3">
                  {exam.status === "em_andamento" ? (
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Continuar →
                    </span>
                  ) : exam.score !== null ? (
                    <span className="text-sm text-slate-500 dark:text-slate-400">{exam.score}/100</span>
                  ) : null}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[exam.status]}`}
                  >
                    {statusLabel[exam.status]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {exams.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhuma prova ainda. Capture palavras numa fonte e gere sua
              primeira revisão semanal — a IA monta as questões a partir do seu
              glossário.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
