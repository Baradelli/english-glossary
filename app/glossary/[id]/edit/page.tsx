import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWordDetail } from "../../../../src/application/index.js";
import { wordViewDeps } from "../../../../src/server/container.js";
import { WordEditForm } from "../../../../src/ui/WordEditForm.js";
import { cardClass } from "../../../../src/ui/controls.js";

export const dynamic = "force-dynamic";

export default async function EditWordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const detail = await getWordDetail(wordViewDeps, id);
  if (!detail) notFound();

  const { word } = detail;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Editar palavra</p>
        <h1 className="text-2xl font-bold">{word.term}</h1>
        <p className="mt-1 text-sm text-slate-500">
          A definição geral da palavra. Significados específicos de cada fonte
          são editados na página de cada encontro.
        </p>
      </div>

      <div className={cardClass}>
        <WordEditForm
          wordId={word.id}
          defaultValues={{
            definitionEn: word.definitionEn,
            definitionPt: word.definitionPt,
            examples: word.examples.join("\n"),
          }}
        />
      </div>

      <Link
        href={`/glossary/${word.id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Voltar à palavra
      </Link>
    </div>
  );
}
