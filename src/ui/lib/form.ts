"use client";

import { toast } from "sonner";
import type { FormState } from "../../server/actions.js";

/**
 * Toasts a server action's result: an error toast on failure, a success toast
 * when there's a message. Returns true when the action succeeded so the caller
 * can reset the form or navigate (via result.redirectTo).
 */
export function notify(result: FormState | undefined): boolean {
  if (result?.error) {
    toast.error(result.error);
    return false;
  }
  if (result?.message) toast.success(result.message);
  return true;
}
