"use client";

import type { ReactNode } from "react";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { useEvidence } from "@/lib/demo/use-evidence";

/** Page title row + the data-provenance pills every page carries. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const { live, sample, loaded, error, scenario, graph } = useEvidence();
  return (
    /* Civic's compact city page header (src/app/city/[slug]/page.tsx): one slim
       row, title + description on a baseline, provenance chips below. */
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-[13px] text-faint">{subtitle}</p>}
        <div className="flex w-full flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface px-2.5 py-1 text-[12px] text-subtle">
            <span className="font-semibold text-foreground">{scenario ? scenario.channel : "live"}</span>
            {scenario ? scenario.title : "evidence log"}
          </span>
          {graph.thread && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface px-2.5 py-1 text-[12px] text-subtle">
              thread <span className="font-mono font-semibold text-foreground">{graph.thread}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start">
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
    </section>
  );
}
