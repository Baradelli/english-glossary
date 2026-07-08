import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWordDetail } from "../../../src/application/index.js";
import { wordViewDeps } from "../../../src/server/container.js";
import { StateBadge } from "../../../src/ui/StateBadge.js";
import { KindBadge } from "../../../src/ui/KindBadge.js";

export const dynamic = "force-dynamic";

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function WordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const detail = await getWordDetail(wordViewDeps, id);
  if (!detail) notFound();

  const { word, state, sightings } = detail;

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{word.term}</h1>
            <KindBadge kind={word.kind} />
            <StateBadge state={state} />
          </div>
          <Link
            href={`/glossary/${word.id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Editar
          </Link>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Definição (EN)</dt>
            <dd>{word.definitionEn}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Definição (PT)</dt>
            <dd>{word.definitionPt}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Próxima revisão: {day(word.nextReview)} · repetições {word.repetitions}{" "}
          · intervalo {word.intervalDays}d · facilidade{" "}
          {word.easeFactor.toFixed(2)}
        </p>
      </section>

      {word.examples.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Exemplos autorais
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {word.examples.map((example, i) => (
              <li key={i}>{example}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Fontes onde apareceu ({sightings.length})
        </h2>
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {sightings.map((sighting, i) => (
            <li key={i} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <Link
                  href={`/sources/${sighting.sourceId}`}
                  className="font-medium hover:underline"
                >
                  {sighting.sourceName}
                </Link>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {sighting.isFirstEncounter ? "primeiro encontro" : "reencontro"}{" "}
                  · {day(sighting.seenAt)}
                </span>
              </div>
              {sighting.contextSentence ? (
                <p className="mt-1 text-sm italic text-slate-600 dark:text-slate-400">
                  “{sighting.contextSentence}”
                </p>
              ) : null}
              <Link
                href={`/sightings/${sighting.sightingId}`}
                className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Editar significado nesta fonte
                {sighting.hasOwnDefinition ? " (personalizado)" : ""}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/glossary" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Voltar ao glossário
      </Link>
    </div>
  );
}
