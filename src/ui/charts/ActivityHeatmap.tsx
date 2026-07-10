import type { ReactNode } from "react";
import Link from "next/link";
import {
  MONTH_LABELS_PT,
  WEEKDAY_LABELS_PT,
  type ActivityCalendar,
  type HeatmapDay,
} from "../../domain/index.js";
import { cn } from "./../lib/cn.js";

/**
 * GitHub-style activity calendar (server component — plain divs, no chart
 * lib). Columns are weeks, rows are local days sunday→saturday; the color
 * ramp below was contrast-validated: blue-200/300 as low levels in light mode
 * fail against white, so light starts at blue-400 and dark inverts the scale.
 */

const LEVEL_CLASSES = [
  "bg-slate-100 dark:bg-slate-800",
  "bg-blue-400 dark:bg-blue-700",
  "bg-blue-600 dark:bg-blue-500",
  "bg-blue-800 dark:bg-blue-300",
  "bg-blue-950 dark:bg-blue-100",
] as const;

/** Rows that show their weekday label (seg/qua/sex); the rest stay invisible. */
const LABELED_WEEKDAYS = new Set([1, 3, 5]);

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "2026-07-08" → "8 de jul". */
function dayTitle(day: HeatmapDay): string {
  const date = `${Number(day.key.slice(8, 10))} de ${
    MONTH_LABELS_PT[Number(day.key.slice(5, 7)) - 1]
  }`;
  if (day.total === 0) return `${date} · sem atividade`;
  const parts: string[] = [date];
  if (day.reviewCount > 0) {
    parts.push(plural(day.reviewCount, "revisão", "revisões"));
  }
  if (day.captureCount > 0) {
    parts.push(plural(day.captureCount, "captura", "capturas"));
  }
  return parts.join(" · ");
}

export function ActivityHeatmap({
  calendar,
}: {
  calendar: ActivityCalendar;
}): ReactNode {
  const summary =
    calendar.totalActions === 0
      ? "Calendário de atividade dos últimos 4 meses: nenhuma ação registrada ainda."
      : `Calendário de atividade dos últimos 4 meses: ${plural(
          calendar.totalActions,
          "ação",
          "ações",
        )} em ${plural(calendar.activeDayCount, "dia ativo", "dias ativos")}, sequência atual de ${plural(
          calendar.streakDays,
          "dia",
          "dias",
        )}.`;

  return (
    <div>
      <p className="sr-only">{summary}</p>

      <div role="img" aria-label={summary}>
        <div aria-hidden="true" className="flex gap-[3px] overflow-x-auto pb-1">
          {/* Weekday labels — a spacer keeps them aligned below the month row. */}
          <div className="flex flex-col gap-[3px] pr-1 text-[10px] text-slate-500 dark:text-slate-400">
            <div className="h-4" />
            {WEEKDAY_LABELS_PT.map((label, weekday) => (
              <div
                key={label}
                className={cn(
                  "flex h-3 items-center leading-none",
                  !LABELED_WEEKDAYS.has(weekday) && "invisible",
                )}
              >
                {label}
              </div>
            ))}
          </div>

          <div>
            {/* Month labels, anchored to the column whose sunday starts the month. */}
            <div
              className="grid h-4 gap-[3px] text-[10px] text-slate-500 dark:text-slate-400"
              style={{
                gridTemplateColumns: `repeat(${calendar.weeks.length}, 0.75rem)`,
              }}
            >
              {calendar.monthLabels.map((month) => (
                <span
                  key={`${month.weekIndex}-${month.label}`}
                  className="whitespace-nowrap leading-none"
                  style={{ gridColumnStart: month.weekIndex + 1 }}
                >
                  {month.label}
                </span>
              ))}
            </div>

            <div className="flex gap-[3px]">
              {calendar.weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  {week.map((day) => (
                    <div
                      key={day.key}
                      title={dayTitle(day)}
                      className={cn(
                        "h-3 w-3 rounded-[3px]",
                        LEVEL_CLASSES[day.level] ?? LEVEL_CLASSES[0],
                        day.isToday &&
                          "outline outline-1 outline-offset-1 outline-blue-600 dark:outline-blue-300",
                        !day.inRange && "invisible",
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer lives outside the role="img" wrapper so the teaching link
          stays reachable by keyboard and screen readers. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          {calendar.totalActions === 0 ? (
            <p>
              Nenhuma atividade ainda — capture palavras em uma{" "}
              <Link
                href="/sources"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                fonte
              </Link>{" "}
              ou revise para pintar o calendário.
            </p>
          ) : (
            <p>
              {plural(calendar.totalActions, "ação", "ações")} em{" "}
              {plural(calendar.activeDayCount, "dia", "dias")}
            </p>
          )}
          <div aria-hidden="true" className="flex items-center gap-1">
            <span>menos</span>
            {LEVEL_CLASSES.map((levelClass) => (
              <span
                key={levelClass}
                className={cn("h-3 w-3 rounded-[3px]", levelClass)}
              />
            ))}
            <span>mais</span>
          </div>
        </div>
    </div>
  );
}
