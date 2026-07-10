import type { ReactNode } from "react";
import Link from "next/link";
import { formatDayKeyShort } from "../src/domain/index.js";
import { getDashboardData, getSettingsView } from "../src/application/index.js";
import { dashboardDeps, repos } from "../src/server/container.js";
import { ActivityHeatmap } from "../src/ui/charts/ActivityHeatmap.js";
import { DifficultWordsList } from "../src/ui/charts/DifficultWordsList.js";
import { ExamTrend } from "../src/ui/charts/ExamTrend.js";
import { ReviewForecastChart } from "../src/ui/charts/ReviewForecast.js";
import { VocabGrowthChart } from "../src/ui/charts/VocabGrowthChart.js";
import { cardClass } from "../src/ui/controls.js";
import { OnboardingTour } from "../src/ui/OnboardingTour.js";

export const dynamic = "force-dynamic";

const primaryCtaClass =
  "inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm " +
  "transition-colors duration-150 hover:bg-blue-700";

const outlineCtaClass =
  "inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium " +
  "transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800";

const quietLinkClass =
  "text-sm text-slate-500 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200";

function N({ children }: { children: ReactNode }): ReactNode {
  return <span className="font-semibold">{children}</span>;
}

export default async function DashboardPage(): Promise<ReactNode> {
  const now = new Date();
  const data = await getDashboardData(
    dashboardDeps,
    now,
    now.getTimezoneOffset(),
  );
  const m = data.totals;
  const settings = await getSettingsView(repos.settings);

  const isEmptyDatabase = m.words.total === 0;
  const {
    streakDays,
    dueNowCount,
    dueLaterTodayCount,
    reviewedTodayCount,
    capturedTodayCount,
  } = data.today;
  // First upcoming day (after today) with reviews scheduled, for the
  // "nothing due today" variant of the strip.
  const nextForecastDay = data.forecast.days
    .slice(1)
    .find((day) => day.count > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Painel</h1>

      {/* "Hoje" strip: streak (the ONLY big number on the page) + the day's
          sentence + the primary call to action. */}
      <section
        data-tour="today"
        className={`${cardClass} flex flex-wrap items-center gap-x-6 gap-y-3`}
      >
        {isEmptyDatabase ? (
          <>
            <div>
              <p className="font-semibold">Bem-vindo ao English Glossary!</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Comece registrando uma fonte e capturando palavras dela.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <Link href="/sources" className={primaryCtaClass}>
                Criar fonte
              </Link>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-3xl font-bold tabular-nums">{streakDays}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {streakDays === 1 ? "dia de sequência" : "dias de sequência"}
              </p>
            </div>
            <div className="h-10 border-l border-slate-200 dark:border-slate-700" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {dueNowCount > 0 ? (
                <>
                  <N>{dueNowCount}</N>{" "}
                  {dueNowCount === 1
                    ? "revisão para fazer"
                    : "revisões para fazer"}{" "}
                  agora
                  {dueLaterTodayCount > 0 ? (
                    <> (+{dueLaterTodayCount} mais tarde hoje)</>
                  ) : null}
                </>
              ) : dueLaterTodayCount > 0 ? (
                <>
                  Nada para revisar agora — <N>{dueLaterTodayCount}</N>{" "}
                  {dueLaterTodayCount === 1
                    ? "revisão vence"
                    : "revisões vencem"}{" "}
                  mais tarde hoje
                </>
              ) : nextForecastDay ? (
                <>
                  Nada vence hoje — próxima revisão {nextForecastDay.label} (
                  {formatDayKeyShort(nextForecastDay.key)})
                </>
              ) : (
                <>Nada vence hoje — nenhuma revisão nos próximos 7 dias</>
              )}
              {" · "}
              <N>{reviewedTodayCount}</N> já{" "}
              {reviewedTodayCount === 1 ? "feita" : "feitas"}
              {" · "}
              <N>{capturedTodayCount}</N>{" "}
              {capturedTodayCount === 1
                ? "palavra capturada"
                : "palavras capturadas"}
            </p>
            <div className="ml-auto flex items-center gap-4">
              <Link href="/sources" className={quietLinkClass}>
                Capturar vocabulário
              </Link>
              {dueNowCount > 0 ? (
                <Link href="/exams" className={primaryCtaClass}>
                  Fazer uma prova
                </Link>
              ) : (
                <Link href="/glossary" className={outlineCtaClass}>
                  Ver glossário
                </Link>
              )}
            </div>
          </>
        )}
      </section>

      <div data-tour="dashboard-stats" className="space-y-4">
        <section className={cardClass}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Atividade</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              últimos 4 meses
            </span>
          </div>
          <div className="mt-3">
            <ActivityHeatmap calendar={data.activity} />
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className={cardClass}>
            <h2 className="text-sm font-semibold">Próximos 7 dias</h2>
            <div className="mt-3">
              <ReviewForecastChart
                forecast={data.forecast}
                totalWords={m.words.total}
              />
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-sm font-semibold">Vocabulário</h2>
            <div className="mt-3">
              <VocabGrowthChart
                growth={data.growth}
                composition={data.composition}
              />
            </div>
          </section>
        </div>

        <section className={cardClass}>
          <h2 className="text-sm font-semibold">Provas</h2>
          <div className="mt-3 grid gap-6 md:grid-cols-[3fr,2fr]">
            <div>
              <ExamTrend trend={data.scoreTrend} />
              {m.exams.averageScore !== null ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  média{" "}
                  <span className="font-semibold tabular-nums">
                    {m.exams.averageScore}
                  </span>
                  /100 em {m.exams.corrected}{" "}
                  {m.exams.corrected === 1
                    ? "prova concluída"
                    : "provas concluídas"}
                </p>
              ) : null}
            </div>
            {/* Always rendered: the ranking is fed by failed REVIEWS too, so
                it can have entries before any exam is concluded — and the
                list carries its own empty state. */}
            <div>
              <h3 className="text-sm font-semibold">Palavras difíceis</h3>
              <div className="mt-2">
                <DifficultWordsList words={data.difficultWords} />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Quiet totals ruler — the page's only scalar row, every pair a link. */}
      <section className={cardClass}>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <Link href="/glossary" className="group">
            <dt className="text-slate-500 dark:text-slate-400">Palavras</dt>
            <dd className="text-lg font-semibold tabular-nums group-hover:underline">
              {m.words.total}
            </dd>
          </Link>
          <Link href="/sources" className="group">
            <dt className="text-slate-500 dark:text-slate-400">Fontes</dt>
            <dd className="text-lg font-semibold tabular-nums group-hover:underline">
              {m.sources}
            </dd>
          </Link>
          <Link href="/exams" className="group">
            <dt className="text-slate-500 dark:text-slate-400">
              Revisões (7 dias)
            </dt>
            <dd className="text-lg font-semibold tabular-nums group-hover:underline">
              {m.reviewsLast7Days}
            </dd>
          </Link>
          <Link href="/exams" className="group">
            <dt className="text-slate-500 dark:text-slate-400">Provas</dt>
            <dd className="text-lg font-semibold tabular-nums group-hover:underline">
              {m.exams.total}{" "}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                ({m.exams.corrected} concluídas)
              </span>
            </dd>
          </Link>
        </dl>
      </section>

      <OnboardingTour autoStart={settings.onboardingSeenAt === null} />
    </div>
  );
}
