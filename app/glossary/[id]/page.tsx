import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWordDetail } from "../../../src/application/index.js";
import { wordViewDeps } from "../../../src/server/container.js";
import { StateBadge } from "../../../src/ui/StateBadge.js";

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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{word.term}</h1>
          <StateBadge state={state} />
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-slate-500">Definição (EN)</dt>
            <dd>{word.definitionEn}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Definição (PT)</dt>
            <dd>{word.definitionPt}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-slate-500">
          Próxima revisão: {day(word.nextReview)} · repetições {word.repetitions}{" "}
          · intervalo {word.intervalDays}d · facilidade{" "}
          {word.easeFactor.toFixed(2)}
        </p>
      </section>

      {word.examples.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-slate-500">
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
        <h2 className="text-sm font-medium text-slate-500">
          Fontes onde apareceu ({sightings.length})
        </h2>
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {sightings.map((sighting, i) => (
            <li key={i} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <Link
                  href={`/sources/${sighting.sourceId}`}
                  className="font-medium hover:underline"
                >
                  {sighting.sourceName}
                </Link>
                <span className="text-xs text-slate-500">
                  {sighting.isFirstEncounter ? "primeiro encontro" : "reencontro"}{" "}
                  · {day(sighting.seenAt)}
                </span>
              </div>
              {sighting.contextSentence ? (
                <p className="mt-1 text-sm italic text-slate-600">
                  “{sighting.contextSentence}”
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <Link href="/glossary" className="text-sm text-blue-600 hover:underline">
        ← Voltar ao glossário
      </Link>
    </div>
  );
}
