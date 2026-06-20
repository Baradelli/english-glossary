import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { repos } from "../../../src/server/container.js";
import { getAiProvider } from "../../../src/infra/ai/provider.js";
import { CopyBlock } from "../../../src/ui/CopyBlock.js";
import {
  AnswersForm,
  AutoCorrectForm,
  CorrectionForm,
} from "../../../src/ui/ExamForms.js";
import { cardClass } from "../../../src/ui/controls.js";
import type { ExamType } from "../../../src/domain/index.js";

export const dynamic = "force-dynamic";

const typeLabel: Record<ExamType, string> = {
  semanal: "Revisão semanal",
  vocabulario: "Prova de vocabulário",
  compreensao: "Prova de compreensão",
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

export default async function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const exam = await repos.exams.findById(id);
  if (!exam) notFound();

  const apiEnabled = getAiProvider() !== null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">
          {typeLabel[exam.type]} · {exam.status}
        </p>
        <h1 className="text-2xl font-bold">Prova</h1>
      </header>

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
              <p className="mt-1 text-sm text-slate-500">
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
          <ul className="mt-4 divide-y divide-slate-100">
            {exam.resultJson.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 py-2">
                <span className={item.correct ? "text-emerald-600" : "text-red-600"}>
                  {item.correct ? "✓" : "✗"}
                </span>
                <span>
                  <span className="font-medium">{item.term}</span>
                  {item.note ? (
                    <span className="text-slate-500"> — {item.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            {exam.resultJson.feedback}
          </p>
        </section>
      ) : null}

      <Link href="/exams" className="text-sm text-blue-600 hover:underline">
        ← Voltar às provas
      </Link>
    </div>
  );
}
