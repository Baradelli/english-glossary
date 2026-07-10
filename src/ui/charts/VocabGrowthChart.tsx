"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatDayKeyShort,
  type GrowthPoint,
  type VocabGrowth,
} from "../../domain/index.js";
import { ChartTooltipBox } from "./ChartTooltip.js";

/**
 * Cumulative vocabulary curve (Fase 3 — Recharts area chart) plus the CURRENT
 * per-state composition as a stacked bar below it. The curve is honest — no
 * historical state reconstruction — so the composition is explicitly labeled
 * "composição atual". The X axis is a LINEAR TIME scale (numeric epoch ms),
 * never categorical: growth points exist only on capture days, and spacing
 * them by index would collapse idle months into a single segment.
 */

interface Composition {
  readonly nova: number;
  readonly aprendendo: number;
  readonly dominada: number;
}

const COMPOSITION_SEGMENTS = [
  { state: "nova", label: "novas", dotClass: "bg-sky-500 dark:bg-sky-400" },
  {
    state: "aprendendo",
    label: "aprendendo",
    dotClass: "bg-amber-500 dark:bg-amber-400",
  },
  {
    state: "dominada",
    label: "dominadas",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
  },
] as const;

/** Smallest "nice" ceiling (1/2/5 × 10^n, min 10) at or above the value. */
function niceCeil(value: number): number {
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const factor of [1, 2, 5, 10]) {
    if (value <= factor * magnitude) return factor * magnitude;
  }
  return 10 * magnitude;
}

function wordsLabel(count: number): string {
  return `${count} ${count === 1 ? "palavra" : "palavras"}`;
}

function GrowthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: GrowthPoint }>;
}): ReactNode {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <ChartTooltipBox>
      <p className="text-slate-700 dark:text-slate-300">
        <span className="font-medium">{formatDayKeyShort(point.key)}</span> ·{" "}
        {wordsLabel(point.cumulative)}
      </p>
    </ChartTooltipBox>
  );
}

function CompositionBar({
  composition,
  totalWords,
}: {
  composition: Composition;
  totalWords: number;
}): ReactNode {
  return (
    <div className="mt-3">
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
        {COMPOSITION_SEGMENTS.map((segment) => {
          const count = composition[segment.state];
          if (count === 0) return null;
          return (
            <div
              key={segment.state}
              className={segment.dotClass}
              style={{ flexGrow: count }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {COMPOSITION_SEGMENTS.map((segment) => (
          <span key={segment.state} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${segment.dotClass}`} />
            {composition[segment.state]} {segment.label}
          </span>
        ))}
        <span className="ml-auto">composição atual</span>
      </div>
      <p className="sr-only">
        Composição atual das {wordsLabel(totalWords)}: {composition.nova} novas,{" "}
        {composition.aprendendo} aprendendo, {composition.dominada} dominadas.
      </p>
    </div>
  );
}

export function VocabGrowthChart({
  growth,
  composition,
}: {
  growth: VocabGrowth;
  composition: Composition;
}): ReactNode {
  if (growth.totalWords === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        O crescimento do seu vocabulário aparece aqui — capture a primeira
        palavra em uma{" "}
        <Link
          href="/sources"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          fonte
        </Link>
        .
      </p>
    );
  }

  // A single-day history has no curve to draw yet — show the stat instead.
  if (growth.spanDays < 2) {
    return (
      <div>
        <p className="text-2xl font-semibold">{wordsLabel(growth.totalWords)}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          primeira captura em{" "}
          {growth.firstKey ? formatDayKeyShort(growth.firstKey) : "—"}
        </p>
        <CompositionBar composition={composition} totalWords={growth.totalWords} />
      </div>
    );
  }

  // Numeric time value per point (UTC midnight of the DayKey) so Recharts
  // spaces the curve proportionally to elapsed time, not by point index.
  const data = growth.points.map((point) => ({
    ...point,
    time: Date.parse(`${point.key}T00:00:00.000Z`),
  }));
  const firstTime = data[0]?.time ?? 0;
  const lastTime = data[data.length - 1]?.time ?? 0;

  return (
    <div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={[firstTime, lastTime]}
              ticks={[firstTime, lastTime]}
              tickFormatter={(time: number) =>
                time === lastTime
                  ? "hoje"
                  : formatDayKeyShort(new Date(time).toISOString().slice(0, 10))
              }
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
            />
            <YAxis
              hide
              domain={[0, niceCeil(growth.totalWords)]}
              allowDataOverflow={false}
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-grid)" }}
              content={<GrowthTooltip />}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="var(--chart-accent)"
              strokeWidth={2}
              fill="var(--chart-accent-soft)"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="sr-only">
        Crescimento do vocabulário: {wordsLabel(growth.totalWords)} acumuladas
        desde {growth.firstKey ? formatDayKeyShort(growth.firstKey) : "—"}.
      </p>

      <CompositionBar composition={composition} totalWords={growth.totalWords} />
    </div>
  );
}
