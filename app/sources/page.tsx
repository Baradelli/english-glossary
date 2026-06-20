import type { ReactNode } from "react";
import Link from "next/link";
import { listSources } from "../../src/application/index.js";
import { repos } from "../../src/server/container.js";
import { NewSourceTypeForm } from "../../src/ui/SourceForms.js";
import { cardClass } from "../../src/ui/controls.js";

export const dynamic = "force-dynamic";

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}): Promise<ReactNode> {
  const { type } = await searchParams;
  const [sources, types] = await Promise.all([
    listSources(repos.sources, type || undefined),
    repos.sourceTypes.list(),
  ]);
  const typeName = (id: string): string =>
    types.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fontes</h1>
        <Link
          href="/sources/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nova fonte
        </Link>
      </section>

      {types.length > 0 ? (
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/sources"
            className={`rounded-full px-3 py-1 ${type ? "bg-slate-100" : "bg-blue-100 text-blue-800"}`}
          >
            Todas
          </Link>
          {types.map((t) => (
            <Link
              key={t.id}
              href={`/sources?type=${t.id}`}
              className={`rounded-full px-3 py-1 ${type === t.id ? "bg-blue-100 text-blue-800" : "bg-slate-100"}`}
            >
              {t.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <section>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {sources.map((source) => (
            <li key={source.id}>
              <Link
                href={`/sources/${source.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <span className="font-medium">{source.name}</span>
                <span className="text-xs text-slate-500">
                  {typeName(source.sourceTypeId)}
                </span>
              </Link>
            </li>
          ))}
          {sources.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              Nenhuma fonte ainda.
            </li>
          ) : null}
        </ul>
      </section>

      <section className={cardClass}>
        <h2 className="text-sm font-semibold text-slate-700">
          Tipos de fonte ({types.length})
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {types.map((t) => t.name).join(", ") || "Nenhum tipo cadastrado."}
        </p>
        <div className="mt-4">
          <NewSourceTypeForm />
        </div>
      </section>
    </div>
  );
}
