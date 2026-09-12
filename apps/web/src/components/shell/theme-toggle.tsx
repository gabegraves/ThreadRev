"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/civic-ui/lib/cn";

const KEY = "threadrev.theme";

/** Class-based dark mode: toggles `.dark` on <html>. Default light; the no-flash script in layout.tsx applies the stored value before paint. */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border border-hairline bg-surface text-[12px] font-medium text-subtle outline-none transition-colors hover:bg-overlay hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/60",
        className,
      )}
    >
      {dark ? <Sun className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> : <Moon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
      <span className="hidden lg:inline">{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

export const THEME_INIT = `try{if(localStorage.getItem("${KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
