"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { ForecastDay, ReviewForecast } from "../../domain/index.js";
import { ChartTooltipBox } from "./ChartTooltip.js";

/**
 * Bar chart of the next 7 local days of due reviews (Fase 3 — Recharts).
 * Everything overdue accumulates in today's bar, which is the only accented
 * one; future days stay de-emphasized. With at most 7 bars the value sits on
 * top of each bar (LabelList) instead of a Y axis.
 */

function reviewsLabel(count: number): string {
  return `${count} ${count === 1 ? "revisão" : "revisões"}`;
}

function ForecastTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: ForecastDay }>;
}): ReactNode {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;
  return (
    <ChartTooltipBox>
      <p className="text-slate-700 dark:text-slate-300">
        <span className="font-medium">{day.label}</span> ·{" "}
        {reviewsLabel(day.count)}
      </p>
    </ChartTooltipBox>
  );
}

export function ReviewForecastChart({
  forecast,
  totalWords,
}: {
  forecast: ReviewForecast;
  totalWords: number;
}): ReactNode {
  if (forecast.weekTotal === 0 && totalWords === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sua agenda de revisões aparece aqui — capture palavras em uma{" "}
        <Link
          href="/sources"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          fonte
        </Link>{" "}
        para começar.
      </p>
    );
  }

  if (forecast.weekTotal === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Nenhuma revisão nos próximos 7 dias — tudo em dia.
      </p>
    );
  }

  const data = forecast.days.map((day) => ({ ...day }));

  return (
    <div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--chart-accent-soft)" }}
              content={<ForecastTooltip />}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="count"
                position="top"
                fill="var(--chart-axis)"
                fontSize={12}
                className="tabular-nums"
              />
              {data.map((day) => (
                <Cell
                  key={day.key}
                  fill={
                    day.isToday ? "var(--chart-accent)" : "var(--chart-bar-muted)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="sr-only">
        {forecast.days.map((day) => (
          <li key={day.key}>
            {day.label}: {reviewsLabel(day.count)}
          </li>
        ))}
      </ul>

      {forecast.dueNowCount > 0 ? (
        <p className="mt-2 text-sm">
          <Link
            href="/exams"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Fazer uma prova →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
