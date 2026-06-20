import type { ReactNode } from "react";
import Link from "next/link";
import { repos } from "../src/server/container.js";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<ReactNode> {
  const [words, sources] = await Promise.all([
    repos.words.listAll(),
    repos.sources.list(),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">English Glossary</h1>
        <p className="mt-2 text-slate-600">
          Capture vocabulário das fontes que você consome, registre definições e
          exemplos, e construa seu glossário para revisão espaçada.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/glossary"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"
        >
          <p className="text-sm font-medium text-slate-500">Glossário</p>
          <p className="mt-1 text-2xl font-semibold">{words.length}</p>
          <p className="text-sm text-slate-600">palavras — buscar ou abrir</p>
        </Link>
        <Link
          href="/sources"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"
        >
          <p className="text-sm font-medium text-slate-500">Fontes</p>
          <p className="mt-1 text-2xl font-semibold">{sources.length}</p>
          <p className="text-sm text-slate-600">vídeos, livros… — capturar aqui</p>
        </Link>
      </section>
    </div>
  );
}
