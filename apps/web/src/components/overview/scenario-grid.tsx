"use client";

import { SCENARIOS, type DemoScenario } from "@/lib/demo/scenarios";
import { setScenario, useScenarioId } from "@/lib/demo/store";
import { Badge } from "@/civic-ui/components/Badge";
import { cn } from "@/civic-ui/lib/cn";

function counts(s: DemoScenario) {
  let findings = 0;
  let runs = 0;
  for (const ev of s.events) {
    if (ev.kind === "finding_published") findings += 1;
    else if (ev.kind === "check_run") runs += 1;
  }
  return { findings, runs };
}

/** All demo scenarios as selectable cards; counts derive from each scenario's own events. */
export function ScenarioGrid() {
  const active = useScenarioId();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {SCENARIOS.map((s) => {
        const c = counts(s);
        const selected = s.id === active;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setScenario(s.id)}
            aria-pressed={selected}
            className={cn(
              "flex flex-col gap-2 rounded-[var(--radius-lg)] border bg-surface p-4 text-left shadow-[var(--shadow-card)] transition-colors",
              "hover:border-hairline-strong focus-visible:outline-2 focus-visible:outline-accent",
              selected ? "border-hairline-strong bg-accent-soft" : "border-hairline",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">{s.channel}</p>
              <Badge>{s.kind}</Badge>
            </div>
            <h3 className="text-[13.5px] font-semibold leading-snug text-foreground">{s.title}</h3>
            <p className="line-clamp-3 text-[12.5px] leading-relaxed text-subtle">{s.summary}</p>
            <p className="mt-auto pt-1 font-mono text-[11px] tabular-nums text-faint">
              {c.findings} finding{c.findings === 1 ? "" : "s"} · {c.runs} run{c.runs === 1 ? "" : "s"} · {s.events.length} events
            </p>
          </button>
        );
      })}
    </div>
  );
}
