"use client";

import { Suspense } from "react";
import { AnalyticsInteractive } from "@/civic/analytics/analytics-interactive";
import { FilterProvider } from "@/civic/filters/context";
import { ANALYTICS_CORPUS } from "@/lib/civic-adapters/reports";
import { SCENARIOS } from "@/lib/demo/scenarios";

/* Civic's city analytics page, 1:1. The outer page wrapper (max width,
   gutters) is supplied by the ThreadRev layout; everything inside matches
   Civic's app/city/[slug]/analytics/page.tsx. The corpus is every recorded
   scenario, adapted in src/lib/civic-adapters/reports.ts. */
export default function AnalyticsPage() {
  const { reports, now } = ANALYTICS_CORPUS;
  return (
    <div className="relative flex flex-col bg-background">
      <section className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
        <p className="text-[13px] text-faint">
          All recorded scenarios · {reports.length} findings across {SCENARIOS.length} threads
        </p>
      </section>
      <Suspense fallback={<p className="text-[13px] text-subtle">Loading analytics…</p>}>
        <FilterProvider corpus={reports} now={now}>
          <AnalyticsInteractive />
        </FilterProvider>
      </Suspense>
    </div>
  );
}
