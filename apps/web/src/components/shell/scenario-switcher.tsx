"use client";

/* Adapted 1:1 from Civic src/components/city/city-switcher.tsx (MIT): the
   square initials chip + name trigger and the search popover. Municipalities
   became scenarios; router.push became setScenario. Class strings unchanged. */

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/civic-ui/components/Badge";
import { cn } from "@/civic-ui/lib/cn";
import { SCENARIOS } from "@/lib/demo/scenarios";
import { LIVE_ID, setScenario, useScenarioId } from "@/lib/demo/store";

type Entry = { id: string; name: string; state: string; county: string; live: boolean; kind: "scenario" | "control" | "runtime" };

const DIRECTORY: Entry[] = [
  ...SCENARIOS.map((s) => ({ id: s.id, name: s.title, state: s.channel, county: s.kind === "control" ? "replay control" : "scenario", live: true, kind: s.kind })),
  { id: LIVE_ID, name: "Live evidence log", state: "/api/evidence", county: "runtime", live: true, kind: "runtime" },
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

export function ScenarioSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  const currentId = useScenarioId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const current = DIRECTORY.find((m) => m.id === currentId) ?? DIRECTORY[0]!;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DIRECTORY;
    return DIRECTORY.filter((m) => m.name.toLowerCase().includes(q) || m.county.toLowerCase().includes(q) || m.state.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function select(id: string) {
    setOpen(false);
    if (id !== currentId) setScenario(id);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex min-w-0 max-w-full items-center gap-2 rounded-[var(--radius-md)] border text-[13px] font-medium transition-colors",
          compact ? "h-8 px-2.5" : "min-h-11 px-3",
          open ? "border-accent/40 bg-accent-soft text-foreground" : "border-hairline bg-overlay text-foreground hover:border-hairline-strong hover:text-foreground",
        )}
      >
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-elevated font-mono text-[11px] font-semibold text-foreground">
          {initials(current.name)}
        </span>
        <span className="truncate">
          {current.name}
          {current.state && <span className="text-faint">, {current.state}</span>}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Switch scenario"
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-50 w-[20rem] origin-top",
            "rounded-[var(--radius-lg)] border border-hairline bg-surface p-2",
            "shadow-[var(--shadow-pop)] ring-1 ring-hairline",
          )}
        >
          <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-hairline bg-overlay px-2.5">
            <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search scenarios"
              className="min-h-10 w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-faint"
            />
          </div>

          <div className="max-h-[18rem] overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-2 py-6 text-center text-[13px] text-faint">No scenarios match &ldquo;{query}&rdquo;.</p>
            ) : (
              results.map((m) => {
                const selected = m.id === currentId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => select(m.id)}
                    aria-current={selected ? "true" : undefined}
                    className={cn("flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-overlay", selected && "bg-overlay-strong")}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        selected ? "border-accent bg-accent text-accent-contrast" : "border-hairline-strong text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("truncate text-[14px] font-medium", selected ? "text-foreground" : "text-subtle")}>
                        {m.name}
                        {m.state ? `, ${m.state}` : ""}
                      </span>
                      <span className="truncate text-[11px] text-faint">{m.county}</span>
                    </span>
                    {m.kind === "runtime" ? (
                      <Badge variant="info" className="shrink-0">
                        Live
                      </Badge>
                    ) : m.kind === "control" ? (
                      <Badge className="shrink-0">Control</Badge>
                    ) : (
                      <Badge variant="success" className="shrink-0">
                        Demo
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
