"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useEffect, useRef } from "react";
import { markOnboardingSeenAction } from "../server/actions.js";

/** How long to wait after mount before starting the tour, so the dashboard
 * has finished its first paint (data-tour anchors are already in the DOM by
 * then, but a small delay avoids the popover flashing in mid-layout). */
const TOUR_START_DELAY_MS = 200;

const TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Bem-vindo ao English Glossary!",
      description:
        "Seu glossário pessoal de inglês. O fluxo: registre as <strong>fontes</strong> " +
        "que você consome, <strong>capture</strong> palavras com o contexto original, " +
        "<strong>revise</strong> com repetição espaçada e teste-se em <strong>provas</strong>. " +
        "Vamos dar uma volta?",
    },
  },
  {
    element: '[data-tour="nav-sources"]',
    popover: {
      title: "1. Fontes",
      description:
        "Tudo começa aqui: cadastre o vídeo, livro ou artigo que você está consumindo " +
        "e, dentro dele, capture palavras novas junto com a frase em que apareceram.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-glossary"]',
    popover: {
      title: "2. Glossário",
      description:
        "Todas as palavras e expressões capturadas, com definição, contexto e " +
        "estado de aprendizado: nova, aprendendo ou dominada.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-review"]',
    popover: {
      title: "3. Revisão",
      description:
        "A repetição espaçada (SM-2) monta sua fila diária. Avalie o quanto lembra " +
        "de cada palavra e o sistema agenda a próxima revisão.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-exams"]',
    popover: {
      title: "4. Provas",
      description:
        "Gere provas a partir do seu vocabulário ou de uma fonte, responda e " +
        "receba correção com nota.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="dashboard-stats"]',
    popover: {
      title: "Seu progresso",
      description:
        "O Painel resume tudo: palavras por estado, fontes cadastradas, revisões " +
        "dos últimos 7 dias e o resultado das provas.",
      side: "top",
      align: "start",
    },
  },
  {
    element: '[data-tour="backup"]',
    popover: {
      title: "Backup",
      description:
        "Exporte todos os seus dados em um arquivo JSON quando quiser. Guarde-o " +
        "em local seguro — dá para restaurar em Configurações.",
      side: "top",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: "Configurações",
      description:
        "Configure sua chave de API (necessária para os recursos de IA), gerencie " +
        "backups e reveja este tour quando quiser.",
      side: "bottom",
      align: "start",
    },
  },
  {
    popover: {
      title: "Pronto para começar!",
      description:
        "Crie sua primeira fonte em <strong>Fontes</strong> e capture suas primeiras " +
        "palavras. Bons estudos!",
    },
  },
];

/**
 * Guided tour over the real dashboard UI (driver.js). Mounted once on the
 * Painel (`/`); `autoStart` comes from the server (`onboardingSeenAt === null`)
 * so there's no client-side flash. Every exit path funnels through driver.js's
 * `onDestroyed` hook (Concluir, Pular, the "x", Esc, overlay click), which is
 * what actually marks the flag as seen — see the single call site below.
 */
export function OnboardingTour({ autoStart }: { autoStart: boolean }): null {
  // Guards against React StrictMode's dev-only double-invoke of this effect.
  // The phantom first run's cleanup cancels its own timer below before it
  // fires, so in practice only the surviving run's timer ever reaches this
  // check — kept as a defensive second line in case that ordering changes.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!autoStart) return;

    const tourDriver = driver({
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
      doneBtnText: "Concluir",
      allowClose: true,
      disableActiveInteraction: true,
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: "eg-tour",
      smoothScroll: true,
      steps: TOUR_STEPS,
      // driver.js 1.x has no built-in "skip" action, so we inject a plain
      // button into the footer's button cluster and wire it to destroy().
      onPopoverRender: (popover) => {
        const skipButton = document.createElement("button");
        skipButton.type = "button";
        skipButton.className = "driver-popover-footer-btn eg-tour-skip-btn";
        skipButton.textContent = "Pular";
        skipButton.addEventListener("click", () => tourDriver.destroy());
        popover.footerButtons.prepend(skipButton);
      },
      // Single funnel for every exit path (Concluir, Pular, "x", Esc,
      // overlay click) — don't re-show the tour once it's been dismissed.
      onDestroyed: () => {
        markOnboardingSeenAction().catch(() => {});
      },
    });

    const timer = setTimeout(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      tourDriver.drive();
    }, TOUR_START_DELAY_MS);

    return () => {
      clearTimeout(timer);
      tourDriver.destroy();
    };
  }, [autoStart]);

  return null;
}
