"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Shared Tailwind class strings, kept in one place for visual consistency. */
export const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm " +
  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export const labelClass = "block text-sm font-medium text-slate-700";

export const cardClass = "rounded-lg border border-slate-200 bg-white p-5 shadow-sm";

/** Submit button that disables itself and shows a label while the action runs. */
export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
}: {
  children: ReactNode;
  pendingLabel?: string;
}): ReactNode {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Inline success/error banner driven by a server action's returned state. */
export function FormMessage({
  state,
}: {
  state: { error?: string; message?: string };
}): ReactNode {
  if (state.error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
        {state.message}
      </p>
    );
  }
  return null;
}
