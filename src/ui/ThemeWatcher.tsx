"use client";

import { useEffect } from "react";

/**
 * Keeps the "sistema" theme in sync with a live OS-level change (e.g. the
 * user flips Windows from light to dark while the app is open). When the user
 * is in "system" mode, this component responds to OS-level theme flips.
 * When in "light"/"dark" mode, the listener is subscribed but gated by the
 * check inside the handler. See the inline anti-FOUC script in the layout
 * for the first-paint case; this component only handles changes after mount.
 */
export function ThemeWatcher(): null {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent): void => {
      if (document.documentElement.dataset.theme !== "system") return;
      document.documentElement.classList.toggle("dark", e.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
