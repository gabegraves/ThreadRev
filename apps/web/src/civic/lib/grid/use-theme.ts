"use client";

/* Shim for Civic's `@/lib/theme` useTheme(). ThreadRev's theme is the `dark`
   class on <html> (see components/shell/theme-toggle.tsx), so this just
   watches that class. Server snapshot is "dark" to match THEME_INIT's default. */

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}

const read = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

export function useTheme(): { theme: Theme } {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  return { theme };
}
