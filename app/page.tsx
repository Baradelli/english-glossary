import type { ReactNode } from "react";

/**
 * Placeholder landing (Phase 3a scaffold). Phase 3b replaces this with the real
 * capture flow: glossary search/register, source & type management, batch
 * capture from a source page, and the per-word / per-source views.
 */
export default function HomePage(): ReactNode {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">English Glossary</h1>
      <p className="mt-3 text-slate-600">
        Glossário pessoal de inglês: captura de vocabulário, revisão espaçada
        (SM-2) e provas geradas por IA.
      </p>
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-500">Status</p>
        <p className="mt-1">
          Núcleo de domínio e persistência prontos. As telas do Fluxo A chegam
          na próxima fase.
        </p>
      </div>
    </main>
  );
}
