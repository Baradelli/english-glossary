import type { ReactNode } from "react";

/** Shared Tailwind class strings, kept in one place for visual consistency. */
export const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm " +
  "dark:border-slate-700 dark:bg-slate-900 " +
  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";

export const cardClass =
  "rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

/** Submit button driven by React Hook Form's isSubmitting. */
export function SubmitButton({
  children,
  pending,
  pendingLabel = "Salvando…",
}: {
  children: ReactNode;
  pending: boolean;
  pendingLabel?: string;
}): ReactNode {
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

/** Inline validation message for a form field. */
export function FieldError({
  message,
}: {
  message?: string | undefined;
}): ReactNode {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>;
}
