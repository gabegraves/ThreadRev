"use client";

/**
 * Scenario store — which evidence log the console is looking at.
 *
 * Module-level snapshot + useSyncExternalStore (the Civic house pattern),
 * persisted to localStorage. "live" reads GET /api/evidence (the real log, or
 * agent-core's Scenario A sample when the log is empty); every other id is one
 * of the generated demo scenarios in ./scenarios.ts.
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_SCENARIO, SCENARIOS } from "./scenarios";

export const LIVE_ID = "live";
const STORAGE_KEY = "threadrev.scenario";

let current: string = DEFAULT_SCENARIO;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): string {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === LIVE_ID || SCENARIOS.some((s) => s.id === v)) return v as string;
  } catch {}
  return DEFAULT_SCENARIO;
}

function hydrateOnce() {
  if (hydrated || typeof window === "undefined") return;
  current = readStorage();
  hydrated = true;
}

export function setScenario(id: string) {
  current = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {}
  for (const l of listeners) l();
}

export function useScenarioId(): string {
  return useSyncExternalStore(
    (cb) => {
      hydrateOnce();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      hydrateOnce();
      return current;
    },
    () => DEFAULT_SCENARIO,
  );
}
