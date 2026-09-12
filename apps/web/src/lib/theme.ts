"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  parseTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "./theme-script";

/**
 * Theme store — light <-> dark, class-driven.
 *
 * Ported from Civic's `src/lib/theme.ts`. The single source of truth is the
 * `dark` class on <html>; every themeable surface keys off it (see the token
 * layer at the top of app/globals.css). `THEME_INIT_SCRIPT` sets that class
 * before first paint; this store keeps it in sync afterwards.
 *
 * A module-level snapshot plus `useSyncExternalStore` rather than Context: the
 * value is read by unrelated leaves on both routes, it changes rarely, and a
 * provider would force every page into a client boundary for one boolean.
 */

export type { Theme };

let theme: Theme = DEFAULT_THEME;
let hydrated = false;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return theme;
}

/**
 * The server always renders the default, so the SSR markup matches the <html>
 * class the layout stamps. The client snapshot takes over after hydration.
 */
function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function readStorage(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

function applyClass(next: Theme) {
  document.documentElement.classList.toggle("dark", next === "dark");
}

/**
 * Sync the in-memory snapshot to whatever the boot script already applied.
 * Runs once at client module-eval, before any component reads it.
 */
function hydrateOnce() {
  if (hydrated || typeof window === "undefined") return;
  theme = readStorage();
  applyClass(theme);
  hydrated = true;
}
hydrateOnce();

export function setTheme(next: Theme) {
  if (next === theme) return;
  theme = next;
  applyClass(next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // A rejected write costs the preference on next load, nothing more. The
    // class is already applied, so this session still looks right.
  }
  for (const listener of listeners) listener();
}

/** `[theme, toggle]` — the whole public surface the toggle button needs. */
export function useTheme(): [Theme, () => void] {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, []);
  return [current, toggle];
}
