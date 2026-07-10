"use client";

import type { ReactNode } from "react";

/**
 * Shared container for the dashboards' custom Recharts tooltips. The library
 * default has a fixed white background that breaks dark mode, so every chart
 * passes its own `content` and wraps the pt-BR text in this box.
 */
export function ChartTooltipBox({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {children}
    </div>
  );
}
