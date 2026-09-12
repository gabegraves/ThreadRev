"use client";

/* Adapted 1:1 from Civic src/components/theme-toggle.tsx (MIT). Icon is
   CSS-driven via the `dark:` variant so it is right before hydration; the click
   flips the `dark` class on <html> and persists it. Dark is the default here. */

import { Moon, Sun } from "lucide-react";
import { cn } from "@/civic-ui/lib/cn";

const KEY = "threadrev.theme";

export function ThemeToggle({ className }: { className?: string }) {
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light or dark mode"
      title="Toggle light or dark mode"
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-faint",
        "border-hairline bg-overlay transition-colors duration-150 outline-none",
        "hover:bg-overlay-strong hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-0",
        className,
      )}
    >
      <Sun className="hidden h-3.5 w-3.5 dark:block" strokeWidth={2} aria-hidden="true" />
      <Moon className="block h-3.5 w-3.5 dark:hidden" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

/** Dark is the default (the live Civic register); an explicit "light" choice wins. */
export const THEME_INIT = `try{if(localStorage.getItem("${KEY}")!=="light")document.documentElement.classList.add("dark")}catch(e){}`;
