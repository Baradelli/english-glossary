"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { type ReactNode } from "react";
import { z } from "zod";
import {
  createSourceAction,
  createSourceTypeAction,
} from "../server/actions.js";
import { FieldError, SubmitButton, inputClass, labelClass } from "./controls.js";
import { notify } from "./lib/form.js";
import type { SourceType } from "../domain/index.js";

const typeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do tipo."),
});
type TypeValues = z.infer<typeof typeSchema>;

export function NewSourceTypeForm(): ReactNode {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TypeValues>({
    resolver: zodResolver(typeSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: TypeValues): Promise<void> {
    const fd = new FormData();
    fd.set("name", values.name);
    if (notify(await createSourceTypeAction(fd))) {
      reset({ name: "" });
      router.refresh(); // show the new type in the list
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
      noValidate
    >
      <div className="flex-1">
        <label className={labelClass} htmlFor="typeName">
          Novo tipo de fonte
        </label>
        <input
          id="typeName"
          placeholder="vídeo, filme, livro…"
          className={inputClass}
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div className="sm:pt-6">
        <SubmitButton pending={isSubmitting}>Adicionar tipo</SubmitButton>
      </div>
    </form>
  );
}

const sourceSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da fonte."),
  url: z.string(),
  sourceTypeId: z.string().min(1, "Escolha um tipo de fonte."),
});
type SourceValues = z.infer<typeof sourceSchema>;

export function NewSourceForm({ types }: { types: SourceType[] }): ReactNode {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SourceValues>({
    resolver: zodResolver(sourceSchema),
    defaultValues: { name: "", url: "", sourceTypeId: "" },
  });

  async function onSubmit(values: SourceValues): Promise<void> {
    const fd = new FormData();
    fd.set("name", values.name);
    fd.set("url", values.url);
    fd.set("sourceTypeId", values.sourceTypeId);
    const result = await createSourceAction(fd);
    if (notify(result) && result?.redirectTo) router.push(result.redirectTo);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label className={labelClass} htmlFor="name">
          Nome da fonte
        </label>
        <input id="name" className={inputClass} {...register("name")} />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <label className={labelClass} htmlFor="url">
          URL (opcional)
        </label>
        <input id="url" className={inputClass} {...register("url")} />
      </div>
      <div>
        <label className={labelClass} htmlFor="sourceTypeId">
          Tipo
        </label>
        <select
          id="sourceTypeId"
          className={inputClass}
          {...register("sourceTypeId")}
        >
          <option value="">Selecione…</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        <FieldError message={errors.sourceTypeId?.message} />
        {types.length === 0 ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Cadastre um tipo primeiro (na página de fontes).
          </p>
        ) : null}
      </div>
      <SubmitButton pending={isSubmitting}>Criar fonte</SubmitButton>
    </form>
  );
}
