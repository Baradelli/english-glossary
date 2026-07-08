import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSourceDetail } from "../../../src/application/index.js";
import { sourceViewDeps } from "../../../src/server/container.js";
import { getAiProvider } from "../../../src/server/ai.js";
import { CaptureWordForm } from "../../../src/ui/CaptureWordForm.js";
import { GenerateComprehensionForm } from "../../../src/ui/ExamForms.js";
import { DeleteSourceButton } from "../../../src/ui/DeleteSourceButton.js";
import { cardClass } from "../../../src/ui/controls.js";
import { KindBadge } from "../../../src/ui/KindBadge.js";
import type { SourceWordView } from "../../../src/application/index.js";

export const dynamic = "force-dynamic";

function WordList({ words }: { words: SourceWordView[] }): ReactNode {
  if (words.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {words.map((entry) => (
        <li key={entry.sightingId} className="px-4 py-3">
          <span className="inline-flex items-center gap-2">
            <Link
              href={`/glossary/${entry.word.id}`}
              className="font-medium hover:underline"
            >
              {entry.word.term}
            </Link>
            <KindBadge kind={entry.word.kind} />
          </span>
          <span className="text-slate-500"> — {entry.word.definitionPt}</span>
          {entry.contextSentence ? (
            <p className="mt-1 text-sm italic text-slate-600">
              “{entry.contextSentence}”
            </p>
          ) : null}
          <Link
            href={`/sightings/${entry.sightingId}`}
            className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline"
          >
            Editar significado nesta fonte
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function SourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const detail = await getSourceDetail(sourceViewDeps, id);
  if (!detail) notFound();

  const apiEnabled = (await getAiProvider()) !== null;
  const { source, sourceType, newWords, reencounters, totalWords } = detail;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-slate-500">
          {sourceType?.name ?? "—"}
        </p>
        <h1 className="text-2xl font-bold">{source.name}</h1>
        {source.url ? (
          <a
            href={source.url}
            className="text-sm text-blue-600 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {source.url}
          </a>
        ) : null}
        <p className="mt-2 text-sm text-slate-500">
          {totalWords} {totalWords === 1 ? "encontro" : "encontros"} ·{" "}
          {newWords.length} novas · {reencounters.length} reencontros
        </p>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Capturar nesta fonte</h2>
        <p className="mt-1 text-sm text-slate-500">
          A fonte é o contexto ativo: adicione várias palavras ou expressões
          seguidas sem recolar a identificação.
        </p>
        <div className="mt-4">
          <CaptureWordForm sourceId={source.id} apiEnabled={apiEnabled} />
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Palavras novas ({newWords.length})
          </h2>
          <WordList words={newWords} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Reencontros ({reencounters.length})
          </h2>
          <WordList words={reencounters} />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Prova de compreensão</h2>
        <p className="mt-1 text-sm text-slate-500">
          Gere a prova de compreensão desta fonte (Template 3). Cole uma
          transcrição/resumo para ancorar as perguntas no conteúdo real.
        </p>
        <div className="mt-4">
          <GenerateComprehensionForm sourceId={source.id} />
        </div>
      </section>

      <section className="flex items-center justify-between border-t border-slate-200 pt-6">
        <Link href="/sources" className="text-sm text-blue-600 hover:underline">
          ← Voltar às fontes
        </Link>
        <DeleteSourceButton sourceId={source.id} />
      </section>
    </div>
  );
}
