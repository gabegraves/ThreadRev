"use client";

import { ChevronsUpDown, Radio } from "lucide-react";
import { SCENARIOS } from "@/lib/demo/scenarios";
import { LIVE_ID, setScenario, useScenarioId } from "@/lib/demo/store";

/** Which evidence log the console shows. Sits under the brand row in the rail. */
export function ScenarioSwitcher() {
  const id = useScenarioId();
  const current = SCENARIOS.find((s) => s.id === id);
  return (
    <label className="relative block">
      <span className="sr-only">Scenario</span>
      <select
        value={id}
        onChange={(e) => setScenario(e.target.value)}
        className="h-9 w-full cursor-pointer appearance-none rounded-md border border-hairline bg-surface pl-3 pr-8 text-[13px] font-medium text-foreground outline-none transition-colors hover:border-hairline-strong focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <optgroup label="Scenarios">
          {SCENARIOS.filter((s) => s.kind === "scenario").map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </optgroup>
        <optgroup label="Replay controls">
          {SCENARIOS.filter((s) => s.kind === "control").map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </optgroup>
        <optgroup label="Runtime">
          <option value={LIVE_ID}>Live evidence log</option>
        </optgroup>
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint">
        {id === LIVE_ID ? <Radio className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> : <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
      </span>
      {current && <p className="mt-1.5 truncate px-0.5 font-mono text-[10.5px] text-faint">{current.channel}</p>}
    </label>
  );
}
