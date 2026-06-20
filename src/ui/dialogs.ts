/**
 * SweetAlert2-based dialogs, replacing the browser's native alert/confirm.
 * SweetAlert2 is imported dynamically so it never touches `document` during
 * SSR — call these only from client event handlers.
 */

export interface ConfirmOptions {
  readonly title: string;
  readonly text: string;
  readonly confirmText?: string;
  /** Red, warning-styled confirm for destructive actions. */
  readonly danger?: boolean;
}

/** Shows a confirm dialog; resolves true only if the user confirms. */
export async function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  const { default: Swal } = await import("sweetalert2");
  const result = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: opts.danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Confirmar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: opts.danger ? "#dc2626" : "#2563eb",
    cancelButtonColor: "#64748b",
    reverseButtons: true,
  });
  return result.isConfirmed;
}

/** Shows a small success toast in the corner. */
export async function toastSuccess(message: string): Promise<void> {
  const { default: Swal } = await import("sweetalert2");
  await Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: message,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });
}

/** Shows an error dialog. */
export async function alertError(message: string): Promise<void> {
  const { default: Swal } = await import("sweetalert2");
  await Swal.fire({ icon: "error", title: "Erro", text: message });
}
