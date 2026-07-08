"use client";

import { useEffect } from "react";

/**
 * Keeps `<html class="dark">` in sync with the "sistema"/"claro"/"escuro"
 * setting stored in `data-theme`, for two cases the server render can't cover:
 *
 * 1. A live OS-level flip while the app is open (e.g. Windows switches from
 *    light to dark) when the user is in "sistema" mode.
 * 2. React reconciling the server-rendered `className` back to its
 *    server value. `app/layout.tsx` renders
 *    `className={theme === "dark" ? "dark" : undefined}`, so React — not this
 *    component — owns that attribute. Any `router.refresh()` (e.g. after
 *    saving a setting) re-renders the layout and reconciles the class,
 *    which STRIPS a "dark" class that was only ever applied client-side
 *    (the anti-FOUC script, or case 1 above) because the server-rendered
 *    value doesn't have it. Without the MutationObserver below, switching
 *    Escuro -> Sistema while the OS prefers dark renders light until the
 *    next full reload.
 *
 * `sync()` is the single source of truth for what the class should be; it is
 * safe to call redundantly because it no-ops when the class already matches
 * (that guard is also what keeps the MutationObserver from re-triggering
 * itself on its own class writes).
 */
export function ThemeWatcher(): null {
  useEffect(() => {
    const root = document.documentElement;
    const media = matchMedia("(prefers-color-scheme: dark)");

    const sync = (): void => {
      const theme = root.dataset.theme;
      const wantDark = theme === "dark" || (theme === "system" && media.matches);
      if (root.classList.contains("dark") !== wantDark) {
        root.classList.toggle("dark", wantDark);
      }
    };

    sync();
    media.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributeFilter: ["class", "data-theme"] });

    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  return null;
}
