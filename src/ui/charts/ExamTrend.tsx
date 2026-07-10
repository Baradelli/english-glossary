"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatDayKeyShort,
  type ExamType,
  type ScorePoint,
} from "../../domain/index.js";
import { ChartTooltipBox } from "./ChartTooltip.js";

/**
 * Score trend across concluded exams (Fase 3 — Recharts line chart). The Y
 * axis is FIXED at 0–100 so two charts on different days are comparable; the
 * X axis is ordinal by exam index (dates only at the extremes) because exams
 * cluster in bursts and a time axis would pile the points up.
 */

const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  semanal: "semanal",
  vocabulario: "vocabulário",
  compreensao: "compreensão",
  pratica: "prática",
};

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: ScorePoint }>;
}): ReactNode {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <ChartTooltipBox>
      <p className="text-slate-700 dark:text-slate-300">
        <span className="font-medium">{EXAM_TYPE_LABELS[point.type]}</span> ·{" "}
        {formatDayKeyShort(point.key)} · {point.score}/100
      </p>
    </ChartTooltipBox>
  );
}

export function ExamTrend({ trend }: { trend: ScorePoint[] }): ReactNode {
  if (trend.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Suas notas aparecem aqui — faça sua primeira{" "}
        <Link
          href="/exams"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          prova
        </Link>
        .
      </p>
    );
  }

  const first = trend[0];
  if (trend.length === 1 && first) {
    return (
      <div>
        <p className="text-2xl font-semibold tabular-nums">{first.score}/100</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {EXAM_TYPE_LABELS[first.type]} em {formatDayKeyShort(first.key)} — a
          linha aparece a partir da segunda prova.
        </p>
      </div>
    );
  }

  const data = trend.map((point, index) => ({ ...point, index }));
  const lastIndex = data.length - 1;

  return (
    <div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="index"
              ticks={[0, lastIndex]}
              tickFormatter={(index: number) =>
                formatDayKeyShort(data[index]?.key ?? "")
              }
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              width={28}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-grid)" }}
              content={<TrendTooltip />}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--chart-accent)"
              strokeWidth={2}
              dot={{
                r: 4,
                fill: "var(--chart-accent)",
                stroke: "var(--chart-dot-ring)",
                strokeWidth: 2,
              }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="sr-only">
        {trend.map((point) => (
          <li key={point.examId}>
            Prova {EXAM_TYPE_LABELS[point.type]} de{" "}
            {formatDayKeyShort(point.key)}: nota {point.score} de 100.
          </li>
        ))}
      </ul>
    </div>
  );
}
