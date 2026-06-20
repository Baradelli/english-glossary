import type { ReactNode } from "react";
import Link from "next/link";
import { searchWord, listGlossary } from "../../src/application/index.js";
import { repos, wordViewDeps } from "../../src/server/container.js";
import { inputClass } from "../../src/ui/controls.js";
import { StateBadge } from "../../src/ui/StateBadge.js";

export const dynamic = "force-dynamic";

export default async function GlossaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<ReactNode> {
  const { q } = await searchParams;
  const term = q?.trim() ?? "";
  const [match, words] = await Promise.all([
    term ? searchWord(wordViewDeps, term) : Promise.resolve(null),
    listGlossary(repos.words),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Glossário</h1>
        <form method="get" className="mt-4 flex gap-2">
          <input
            name="q"
            defaultValue={term}
            placeholder="Buscar palavra (exata, sem distinção de maiúsculas)…"
            className={inputClass}
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Buscar
          </button>
        </form>

        {term ? (
          match ? (
            <Link
              href={`/glossary/${match.word.id}`}
              className="mt-4 flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-4 py-3 hover:border-green-400"
            >
              <span>
                <span className="font-semibold">{match.word.term}</span>{" "}
                — {match.word.definitionPt}
              </span>
              <StateBadge state={match.state} />
            </Link>
          ) : (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              “{term}” não está no glossário. Cadastre-a a partir da{" "}
              <Link href="/sources" className="font-medium underline">
                página de uma fonte
              </Link>
              .
            </p>
          )
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-500">
          {words.length} {words.length === 1 ? "palavra" : "palavras"}
        </h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {words.map((word) => (
            <li key={word.id}>
              <Link
                href={`/glossary/${word.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <span>
                  <span className="font-medium">{word.term}</span>
                  <span className="text-slate-500"> — {word.definitionPt}</span>
                </span>
              </Link>
            </li>
          ))}
          {words.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              Nenhuma palavra ainda.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
