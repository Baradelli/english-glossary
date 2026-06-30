import type { ReactNode } from "react";
import Link from "next/link";
import { searchWord, listGlossary } from "../../src/application/index.js";
import type { WordKind } from "../../src/domain/index.js";
import { repos, wordViewDeps } from "../../src/server/container.js";
import { inputClass } from "../../src/ui/controls.js";
import { StateBadge } from "../../src/ui/StateBadge.js";
import { KindBadge } from "../../src/ui/KindBadge.js";

export const dynamic = "force-dynamic";

const KIND_FILTERS = [
  { value: "", label: "Todos" },
  { value: "palavra", label: "Palavras" },
  { value: "expressao", label: "Expressões" },
] as const;

export default async function GlossaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}): Promise<ReactNode> {
  const { q, kind } = await searchParams;
  const term = q?.trim() ?? "";
  const kindFilter: WordKind | null =
    kind === "palavra" || kind === "expressao" ? kind : null;
  const [match, allWords] = await Promise.all([
    term ? searchWord(wordViewDeps, term) : Promise.resolve(null),
    listGlossary(repos.words),
  ]);
  const words = kindFilter
    ? allWords.filter((w) => w.kind === kindFilter)
    : allWords;
  const noun = kindFilter === "expressao" ? "expressão" : "palavra";
  const nounPlural = kindFilter === "expressao" ? "expressões" : "palavras";

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
              <span className="flex shrink-0 items-center gap-2">
                <KindBadge kind={match.word.kind} />
                <StateBadge state={match.state} />
              </span>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-500">
            {words.length} {words.length === 1 ? noun : nounPlural}
          </h2>
          <div className="inline-flex gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            {KIND_FILTERS.map((f) => {
              const active = (kindFilter ?? "") === f.value;
              const params = new URLSearchParams();
              if (term) params.set("q", term);
              if (f.value) params.set("kind", f.value);
              const href = params.toString()
                ? `/glossary?${params.toString()}`
                : "/glossary";
              return (
                <Link
                  key={f.value || "all"}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors " +
                    (active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800")
                  }
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {words.map((word) => (
            <li key={word.id}>
              <Link
                href={`/glossary/${word.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <span>
                  <span className="font-medium">{word.term}</span>
                  <span className="text-slate-500"> — {word.definitionPt}</span>
                </span>
                <KindBadge kind={word.kind} />
              </Link>
            </li>
          ))}
          {words.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              {kindFilter === "expressao"
                ? "Nenhuma expressão ainda."
                : "Nenhuma palavra ainda."}
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
