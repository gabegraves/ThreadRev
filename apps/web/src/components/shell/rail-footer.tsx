"use client";

/* Adapted 1:1 from Civic src/components/view-switch.tsx and the
   PageGuideButton trigger in src/components/page-guide/page-guide.tsx (MIT).
   Civic's User ⇄ City segments became Demo ⇄ Live (which evidence log the
   console reads); the guide dialog became a short "what is this page" sheet. */

import { Database, HelpCircle, Radio } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/civic-ui/lib/cn";
import { DEFAULT_SCENARIO } from "@/lib/demo/scenarios";
import { LIVE_ID, setScenario, useScenarioId } from "@/lib/demo/store";
import { ThemeToggle } from "./theme-toggle";

export function ViewSwitch({ className = "" }: { className?: string }) {
  const id = useScenarioId();
  const onLive = id === LIVE_ID;
  const segments = [
    { key: "demo", label: "Demo", icon: Database, active: !onLive, go: () => setScenario(DEFAULT_SCENARIO) },
    { key: "live", label: "Live", icon: Radio, active: onLive, go: () => setScenario(LIVE_ID) },
  ];
  return (
    <div role="group" aria-label="Switch data source" className={cn("flex shrink-0 items-center gap-0.5 rounded-[10px] border border-hairline bg-overlay p-0.5", className)}>
      {segments.map(({ key, label, icon: Icon, active, go }) => (
        <button
          key={key}
          type="button"
          onClick={go}
          aria-pressed={active}
          aria-label={`${label} data`}
          title={`${label} data`}
          className={cn(
            "group relative inline-flex h-7 items-center gap-1.5 rounded-md px-2 sm:px-2.5 text-[13px] font-medium",
            "transition-colors duration-150 outline-none",
            "focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-0",
            active ? "bg-overlay-strong text-foreground shadow-[inset_0_0_0_1px_var(--hairline)]" : "text-subtle hover:bg-overlay hover:text-foreground",
          )}
        >
          <Icon className={cn("h-3.5 w-3.5 shrink-0 transition-colors duration-150", active ? "text-foreground" : "text-faint group-hover:text-subtle")} strokeWidth={2} aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

const GUIDE: Record<string, { what: string; why: string }> = {
  "/overview": { what: "Counts, the newest live card, recent reviewer activity, and every recorded scenario.", why: "First look for a judge: what the reviewer did on this thread, every number derived from the evidence log." },
  "/thread": { what: "The Slack thread as the reviewer read it, with cards and decisions under the message that triggered them.", why: "Shows the stale card being superseded in place, which is the demo's core beat." },
  "/documents": { what: "Every document the reviewer hashed, with the lines findings quote from it.", why: "Sources carry revision and SHA-256, so a claim can be checked against exact bytes." },
  "/workspace": { what: "The exact-match workspace index: messages by document, unit, author, channel, and what a search returned.", why: "Retrieval here is grep-like, every hit up to the trigger, never a similarity ranking." },
  "/findings": { what: "Every card in publish order, with reproduced numbers separate from inferred claims.", why: "The reviewer never computes a number; a Python checker does, and the card copies it." },
  "/graph": { what: "The evidence graph built from the append-only log; hover a node to see what it invalidates.", why: "'What did this change invalidate' becomes a graph walk instead of a guess." },
  "/runs": { what: "Every checker run with its inputs, outputs, checks, and refused publishes.", why: "A run computed against an outdated revision is refused before it posts." },
  "/analytics": { what: "Operational counts across all recorded scenarios.", why: "Same bento as Civic's city analytics, fed by findings instead of reports." },
};

/** Trigger for the sidebar footer. Sized as a peer of ThemeToggle. */
export function PageGuideButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const key = Object.keys(GUIDE).find((k) => pathname.startsWith(k)) ?? "/overview";
  const guide = GUIDE[key]!;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="About this page"
        title="About this page"
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-faint",
          "border-hairline bg-overlay transition-colors duration-150 outline-none",
          "hover:bg-overlay-strong hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-0",
          className,
        )}
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="About this page" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[var(--radius-lg)] border border-hairline bg-surface p-5 shadow-[var(--shadow-pop)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">What is this page</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">{guide.what}</p>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-faint">Why it exists</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-subtle">{guide.why}</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-hairline bg-overlay px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-overlay-strong">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Civic's two-row footer: the segmented switch on its own row, the two icon controls below. */
export function RailFooterExpanded() {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex h-8 w-full items-center [&>div:first-child]:h-8 [&>div:first-child]:w-full [&>div:first-child]:min-w-0 [&_button]:h-full [&_button]:flex-1">
        <ViewSwitch />
      </div>
      <div className="flex h-8 w-full items-center gap-1.5">
        <PageGuideButton className="h-8 flex-1" />
        <ThemeToggle className="h-8 flex-1" />
      </div>
    </div>
  );
}

export function RailFooterCollapsed() {
  return (
    <div className="flex flex-col gap-1.5">
      <PageGuideButton className="h-9 w-full" />
      <ThemeToggle className="h-9 w-full" />
    </div>
  );
}
