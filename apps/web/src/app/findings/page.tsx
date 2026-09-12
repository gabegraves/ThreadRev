"use client";

import { Suspense } from "react";
import { FindingsExplorer } from "@/components/findings/findings-explorer";

export default function Page() {
  return (
    // Full-bleed: the grid owns the entire content area (toolbar padding lives
    // inside WorkOrderGrid). Civic's city pages own their own padding; here
    // the layout's container carries it (px-3/sm:px-4/lg:px-6,
    // pt-city-content, pb-10), so it is pulled back with matching negative
    // margins. Below md the sticky MobileHeader sits above in flow; its height
    // is subtracted instead of Civic's fixed-header pt offset.
    // Height is 100dvh divided back out of the html `zoom: 0.8` (--app-zoom):
    // dvh resolves BEFORE the zoom scales it, so a plain h-dvh renders at 80%
    // of the viewport and leaves a dead band under the pagination bar.
    <div className="-mx-3 -mb-10 -mt-[calc(env(safe-area-inset-top)+8rem)] flex h-[calc(100dvh/var(--app-zoom,1)-5.5rem)] min-h-[480px] w-auto flex-col overflow-hidden sm:-mx-4 md:-mt-8 md:h-[calc(100dvh/var(--app-zoom,1))] lg:-mx-6">
      {/* Visible title chrome removed to give the grid the full viewport;
          the h1 survives for a11y/SEO. */}
      <h1 className="sr-only">Findings</h1>
      <Suspense fallback={<p className="p-4 text-[13px] text-subtle">Loading findings…</p>}>
        <FindingsExplorer />
      </Suspense>
    </div>
  );
}
