/**
 * Theme constants and the no-flash boot script.
 *
 * Deliberately NOT a `"use client"` module and deliberately free of React: the
 * server-rendered layout needs `THEME_INIT_SCRIPT`, and the client store in
 * `theme.ts` needs the same key and parser. Keeping both in one plain module is
 * what stops the two from drifting — a storage key that disagrees with the boot
 * script is a flash of the wrong theme on every load.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "threadrev.theme";

/** Light is the first-open experience; the toggle reveals dark. */
export const DEFAULT_THEME: Theme = "light";

/**
 * Narrow an unknown stored value to a Theme. Anything that is not exactly
 * "light" or "dark" — a stale key, a hand-edited value, `null` from a cleared
 * store — falls back to the default rather than throwing.
 */
export function parseTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}

/**
 * Runs before first paint, from a `<script>` in <head>. Without it the document
 * paints light, then React hydrates and slams it to dark — the flash every
 * class-based theme has to design around.
 *
 * It is intentionally tiny and dependency-free, reads the same key the store
 * writes, and swallows its own errors: localStorage throws outright in some
 * privacy modes, and a theme preference is never worth breaking the page over.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
