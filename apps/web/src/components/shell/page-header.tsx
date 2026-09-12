"use client";

import type { ReactNode } from "react";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { useEvidence } from "@/lib/demo/use-evidence";

/** Page title row + the data-provenance pills every page carries. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const { live, sample, loaded, error } = useEvidence();
  return (
    /* Title + one meta line. The scenario and thread already live in the
       sidebar switcher, so the header never repeats them. */
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-[12px] text-faint">{subtitle}</p>}
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
