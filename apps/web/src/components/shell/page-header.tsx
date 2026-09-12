"use client";

import type { ReactNode } from "react";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { useEvidence } from "@/lib/demo/use-evidence";

/** Page title row + the data-provenance pills every page carries. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const { live, sample, loaded, error, scenario, graph } = useEvidence();
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
      <div className="min-w-0">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">
          {scenario ? `${scenario.channel} · ${scenario.title}` : "live evidence log"}
          {graph.thread && <> · thread {graph.thread}</>}
        </p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[70ch] text-[13px] text-subtle">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {live ? (
          !loaded ? (
            <StatusPill tone="neutral">loading</StatusPill>
          ) : error ? (
            <StatusPill tone="danger">api unavailable · {error}</StatusPill>
          ) : sample ? (
            <StatusPill tone="warning">live route · sample log</StatusPill>
          ) : (
            <StatusPill tone="success">live · polled 5 s</StatusPill>
          )
        ) : (
          <StatusPill tone="info">demo data · from fixtures</StatusPill>
        )}
      </div>
    </header>
  );
}
