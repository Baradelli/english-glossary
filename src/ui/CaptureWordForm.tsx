"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { captureWordAction, type FormState } from "../server/actions.js";
import { FormMessage, SubmitButton, inputClass, labelClass } from "./controls.js";

const initial: FormState = {};

/**
 * Batch-capture form for a source page. Re-encounters need only the term; a new
 * word needs the definitions and an example (validated server-side). Clears
 * itself after a successful capture so the next word can be added quickly.
 */
export function CaptureWordForm({ sourceId }: { sourceId: string }): ReactNode {
  const [state, formAction] = useActionState(captureWordAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="sourceId" value={sourceId} />

      <div>
        <label className={labelClass} htmlFor="term">
          Palavra
        </label>
        <input id="term" name="term" required className={inputClass} />
        <p className="mt-1 text-xs text-slate-500">
          Se já existir, registramos um reencontro. Formas flexionadas são
          entradas distintas (ex.: “ramble” e “rambling”).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="definitionEn">
            Definição (EN)
          </label>
          <input id="definitionEn" name="definitionEn" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="definitionPt">
            Definição (PT)
          </label>
          <input id="definitionPt" name="definitionPt" className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="examples">
          Frases de exemplo autorais (uma por linha)
        </label>
        <textarea id="examples" name="examples" rows={2} className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="contextSentence">
          Frase de contexto desta fonte (opcional)
        </label>
        <input
          id="contextSentence"
          name="contextSentence"
          className={inputClass}
        />
      </div>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Capturando…">Capturar palavra</SubmitButton>
    </form>
  );
}
