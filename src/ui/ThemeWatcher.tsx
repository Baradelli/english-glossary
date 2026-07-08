"use client";

import { useEffect } from "react";

/**
 * Keeps the "sistema" theme in sync with a live OS-level change (e.g. the
 * user flips Windows from light to dark while the app is open). Only active
 * when `data-theme="system"` — "light"/"dark" are pinned by the user and this
 * watcher has nothing to do. See the inline anti-FOUC script in the layout
 * for the first-paint case; this component only handles changes after mount.
 */
export function ThemeWatcher(): null {
  useEffect(() => {
    if (document.documentElement.dataset.theme !== "system") return;

    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent): void => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
