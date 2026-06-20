import type { ReactNode } from "react";
import Link from "next/link";
import { repos } from "../../src/server/container.js";
import { GenerateExamButtons } from "../../src/ui/ExamForms.js";
import { cardClass } from "../../src/ui/controls.js";
import type { ExamStatus, ExamType } from "../../src/domain/index.js";

export const dynamic = "force-dynamic";

const typeLabel: Record<ExamType, string> = {
  semanal: "Revisão semanal",
  vocabulario: "Vocabulário",
  compreensao: "Compreensão",
};

const statusStyle: Record<ExamStatus, string> = {
  gerada: "bg-sky-100 text-sky-800",
  respondida: "bg-amber-100 text-amber-800",
  corrigida: "bg-emerald-100 text-emerald-800",
};

export default async function ExamsPage(): Promise<ReactNode> {
  const exams = await repos.exams.listAll();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Provas</h1>

      <section className={cardClass}>
        <h2 className="font-semibold">Gerar prova</h2>
        <p className="mt-1 text-sm text-slate-500">
          A prova de compreensão de uma fonte é gerada pela página da fonte.
        </p>
        <div className="mt-4">
          <GenerateExamButtons />
        </div>
      </section>

      <section>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {exams.map((exam) => (
            <li key={exam.id}>
              <Link
                href={`/exams/${exam.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <span className="font-medium">{typeLabel[exam.type]}</span>
                <span className="flex items-center gap-3">
                  {exam.score !== null ? (
                    <span className="text-sm text-slate-500">{exam.score}/100</span>
                  ) : null}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[exam.status]}`}
                  >
                    {exam.status}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {exams.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              Nenhuma prova ainda.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
