"use client";

import { useActionState, type ReactNode } from "react";
import {
  createSourceAction,
  createSourceTypeAction,
  type FormState,
} from "../server/actions.js";
import { FormMessage, SubmitButton, inputClass, labelClass } from "./controls.js";
import type { SourceType } from "../domain/index.js";

const initial: FormState = {};

export function NewSourceTypeForm(): ReactNode {
  const [state, formAction] = useActionState(createSourceTypeAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className={labelClass} htmlFor="typeName">
          Novo tipo de fonte
        </label>
        <input
          id="typeName"
          name="name"
          placeholder="vídeo, filme, livro…"
          className={inputClass}
        />
      </div>
      <SubmitButton>Adicionar tipo</SubmitButton>
      <div className="sm:basis-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function NewSourceForm({ types }: { types: SourceType[] }): ReactNode {
  const [state, formAction] = useActionState(createSourceAction, initial);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="name">
          Nome da fonte
        </label>
        <input id="name" name="name" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="url">
          URL (opcional)
        </label>
        <input id="url" name="url" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="sourceTypeId">
          Tipo
        </label>
        <select id="sourceTypeId" name="sourceTypeId" required className={inputClass}>
          <option value="">Selecione…</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        {types.length === 0 ? (
          <p className="mt-1 text-xs text-amber-700">
            Cadastre um tipo primeiro (na página de fontes).
          </p>
        ) : null}
      </div>
      <FormMessage state={state} />
      <SubmitButton>Criar fonte</SubmitButton>
    </form>
  );
}
