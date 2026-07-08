"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import {
  resetOnboardingAction,
  restoreBackupAction,
  saveAiSettingsAction,
  testAiConnectionAction,
} from "../server/actions.js";
import { SUGGESTED_MODELS } from "../domain/index.js";
import { FieldError, SubmitButton, inputClass, labelClass } from "./controls.js";
import { notify } from "./lib/form.js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/alert-dialog.js";

/** Sentinel `<select>` value that reveals the free-text model input ("Outro…"). */
const CUSTOM_MODEL = "__custom__";

// Mirrors AiSettingsSchema (src/domain/settings/settings.ts) client-side, with
// the same pt-BR messages, so the form can show inline errors before a round
// trip. The server still re-validates — this is only for a fast local echo.
const aiSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") return;
      if (!value.startsWith("sk-ant-")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A chave deve começar com sk-ant-.",
        });
        return;
      }
      if (value.length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Chave de API muito curta.",
        });
      }
    }),
  modelSelect: z.string(),
  modelCustom: z.string(),
});
type AiValues = z.infer<typeof aiSchema>;

function initialModelSelect(model: string | null): string {
  if (model === null) return "";
  return (SUGGESTED_MODELS as readonly string[]).includes(model) ? model : CUSTOM_MODEL;
}

const secondaryButtonClass =
  "inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";

const dangerButtonClass =
  "inline-flex items-center rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 " +
  "dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950";

/**
 * AI key/model settings form. The key's value never lives on the server
 * response beyond hasApiKey/apiKeyHint — this component only ever sees what
 * the user types in the current session, never the stored key.
 */
export function SettingsAiForm({
  hasApiKey,
  apiKeyHint,
  model,
  envKeyPresent,
  defaultModel,
}: {
  hasApiKey: boolean;
  apiKeyHint: string | null;
  model: string | null;
  envKeyPresent: boolean;
  defaultModel: string;
}): ReactNode {
  const router = useRouter();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<AiValues>({
    resolver: zodResolver(aiSchema),
    defaultValues: {
      apiKey: "",
      modelSelect: initialModelSelect(model),
      modelCustom: initialModelSelect(model) === CUSTOM_MODEL ? (model ?? "") : "",
    },
  });

  const modelSelect = watch("modelSelect");
  const showCustomModel = modelSelect === CUSTOM_MODEL;
  const busy = isSubmitting || testing || removing;

  function resolvedModel(values: AiValues): string {
    return values.modelSelect === CUSTOM_MODEL
      ? values.modelCustom.trim()
      : values.modelSelect;
  }

  async function onSubmit(values: AiValues): Promise<void> {
    const fd = new FormData();
    fd.set("apiKey", values.apiKey);
    fd.set("model", resolvedModel(values));
    if (notify(await saveAiSettingsAction(fd))) router.refresh();
  }

  async function onTestConnection(): Promise<void> {
    const values = getValues();
    const fd = new FormData();
    fd.set("apiKey", values.apiKey);
    fd.set("model", resolvedModel(values));
    setTesting(true);
    const result = await testAiConnectionAction(fd);
    setTesting(false);
    notify(result);
  }

  async function onRemoveKey(): Promise<void> {
    const values = getValues();
    const fd = new FormData();
    fd.set("clearKey", "true");
    fd.set("apiKey", "");
    fd.set("model", resolvedModel(values));
    setRemoving(true);
    const result = await saveAiSettingsAction(fd);
    setRemoving(false);
    if (notify(result)) router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label className={labelClass} htmlFor="apiKey">
          Chave de API (Anthropic)
        </label>
        <div className="relative">
          <input
            id="apiKey"
            type={showKey ? "text" : "password"}
            className={`${inputClass} pr-20`}
            placeholder={apiKeyHint ?? "sk-ant-..."}
            autoComplete="off"
            {...register("apiKey")}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
            className="absolute inset-y-0 right-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          >
            {showKey ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <FieldError message={errors.apiKey?.message} />
        {hasApiKey ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Deixe em branco para manter a chave atual.
          </p>
        ) : null}
        {envKeyPresent && !hasApiKey ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Uma chave do arquivo .env está ativa como fallback.
          </p>
        ) : null}
      </div>

      <div>
        <label className={labelClass} htmlFor="modelSelect">
          Modelo
        </label>
        <select id="modelSelect" className={inputClass} {...register("modelSelect")}>
          <option value="">{`Padrão (${defaultModel})`}</option>
          {SUGGESTED_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value={CUSTOM_MODEL}>Outro…</option>
        </select>
        {showCustomModel ? (
          <input
            className={`${inputClass} mt-2`}
            placeholder="ID do modelo"
            {...register("modelCustom")}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pending={isSubmitting}>Salvar</SubmitButton>
        <button
          type="button"
          onClick={onTestConnection}
          disabled={busy}
          className={secondaryButtonClass}
        >
          {testing ? "Testando…" : "Testar conexão"}
        </button>
        {hasApiKey ? (
          <button
            type="button"
            onClick={onRemoveKey}
            disabled={busy}
            className={dangerButtonClass}
          >
            {removing ? "Removendo…" : "Remover chave"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Export/restore backup. Restore replaces ALL study data, so it's gated
 * behind a destructive-confirmation AlertDialog (mirrors DeleteSourceButton).
 */
export function SettingsBackupSection(): ReactNode {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onConfirmRestore(): Promise<void> {
    if (!file) return;
    setRestoring(true);
    const fd = new FormData();
    fd.set("file", file);
    const result = await restoreBackupAction(fd);
    setRestoring(false);
    if (notify(result)) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <a href="/api/backup" download className={secondaryButtonClass}>
        Exportar backup (JSON)
      </a>

      <div className="space-y-2">
        <label className={labelClass} htmlFor="backupFile">
          Restaurar backup
        </label>
        <input
          id="backupFile"
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm text-slate-600 dark:text-slate-400"
        />
        <AlertDialog>
          <AlertDialogTrigger disabled={!file || restoring} className={secondaryButtonClass}>
            Restaurar backup
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar backup?</AlertDialogTitle>
              <AlertDialogDescription>
                Isto substitui TODOS os dados atuais (palavras, fontes, provas,
                histórico). Exporte um backup antes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirmRestore}
                disabled={restoring}
                className="bg-red-600 hover:bg-red-700"
              >
                {restoring ? "Restaurando…" : "Restaurar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/**
 * "Rever tour de boas-vindas": clears the onboardingSeenAt flag and sends the
 * user to the Painel, where {@link OnboardingTour} reads the fresh flag
 * (server-rendered, no client flash) and auto-starts.
 */
export function SettingsOnboardingSection(): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onReplayTour(): Promise<void> {
    setPending(true);
    const result = await resetOnboardingAction();
    setPending(false);
    if (notify(result) && result?.redirectTo) router.push(result.redirectTo);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onReplayTour}
        disabled={pending}
        className={secondaryButtonClass}
      >
        {pending ? "Preparando…" : "Rever tour de boas-vindas"}
      </button>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        O tour roda de novo na próxima visita ao Painel.
      </p>
    </div>
  );
}
