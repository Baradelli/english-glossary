import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSightingDetail } from "../../../src/application/index.js";
import { wordViewDeps } from "../../../src/server/container.js";
import { SightingEditForm } from "../../../src/ui/SightingEditForm.js";
import { cardClass } from "../../../src/ui/controls.js";

export const dynamic = "force-dynamic";

export default async function SightingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const detail = await getSightingDetail(wordViewDeps, id);
  if (!detail) notFound();

  const { sighting, word, source } = detail;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">
          {word ? (
            <Link href={`/glossary/${word.id}`} className="hover:underline">
              {word.term}
            </Link>
          ) : (
            "(palavra removida)"
          )}{" "}
          em{" "}
          {source ? (
            <Link href={`/sources/${source.id}`} className="hover:underline">
              {source.name}
            </Link>
          ) : (
            "(fonte removida)"
          )}
        </p>
        <h1 className="text-2xl font-bold">Significado nesta fonte</h1>
        <p className="mt-1 text-sm text-slate-500">
          {word
            ? `Definição geral: ${word.definitionPt}`
            : ""}{" "}
          — aqui você registra o significado e os exemplos específicos desta
          fonte.
        </p>
      </div>

      <div className={cardClass}>
        <SightingEditForm
          sightingId={sighting.id}
          defaultValues={{
            contextSentence: sighting.contextSentence ?? "",
            definitionEn: sighting.definitionEn ?? "",
            definitionPt: sighting.definitionPt ?? "",
            examples: sighting.examples.join("\n"),
          }}
        />
      </div>

      {word ? (
        <Link
          href={`/glossary/${word.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Voltar à palavra
        </Link>
      ) : null}
    </div>
  );
}
