import type { ReactNode } from "react";
import Link from "next/link";
import { getDashboardMetrics, getSettingsView } from "../src/application/index.js";
import { repos } from "../src/server/container.js";
import { cardClass } from "../src/ui/controls.js";
import { OnboardingTour } from "../src/ui/OnboardingTour.js";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}): ReactNode {
  return (
    <div className={cardClass}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {hint ? <p className="text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default async function DashboardPage(): Promise<ReactNode> {
  const m = await getDashboardMetrics(
    {
      words: repos.words,
      sources: repos.sources,
      reviewLogs: repos.reviewLogs,
      exams: repos.exams,
    },
    new Date(),
  );
  const settings = await getSettingsView(repos.settings);

  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel</h1>
        <a
          href="/api/backup"
          download
          data-tour="backup"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Exportar backup (JSON)
        </a>
      </section>

      <div data-tour="dashboard-stats" className="space-y-4">
        <section className="grid gap-4 sm:grid-cols-3">
          <Link href="/glossary">
            <Stat
              label="Palavras"
              value={m.words.total}
              hint={`${m.words.nova} novas · ${m.words.aprendendo} aprendendo · ${m.words.dominada} dominadas`}
            />
          </Link>
          <Link href="/sources">
            <Stat label="Fontes" value={m.sources} hint="vídeos, livros…" />
          </Link>
          <Link href="/review">
            <Stat
              label="Revisões (7 dias)"
              value={m.reviewsLast7Days}
              hint="palavras avaliadas"
            />
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Link href="/exams">
              <Stat
                label="Provas"
                value={m.exams.total}
                hint={
                  m.exams.corrected > 0
                    ? `${m.exams.corrected} corrigidas · média ${m.exams.averageScore}/100`
                    : "nenhuma corrigida ainda"
                }
              />
            </Link>
          </div>
        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/glossary"
          className="rounded-lg border border-slate-200 bg-white p-5 hover:border-blue-300"
        >
          <p className="font-semibold">Buscar / capturar vocabulário</p>
          <p className="mt-1 text-sm text-slate-600">
            Comece pela fonte que você está consumindo.
          </p>
        </Link>
        <Link
          href="/review"
          className="rounded-lg border border-slate-200 bg-white p-5 hover:border-blue-300"
        >
          <p className="font-semibold">Revisar agora</p>
          <p className="mt-1 text-sm text-slate-600">
            {m.reviewsLast7Days >= 0 ? "Veja a fila de hoje." : ""}
          </p>
        </Link>
      </section>

      <OnboardingTour autoStart={settings.onboardingSeenAt === null} />
    </div>
  );
}
