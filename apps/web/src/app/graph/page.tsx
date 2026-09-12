"use client";

import { Suspense } from "react";
import { GraphExplorer } from "@/components/graph/graph-explorer";

export default function Page() {
  // useSearchParams (the ?node= deep link) needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="p-4 text-[13px] text-subtle">Loading graph…</p>}>
      <GraphExplorer />
    </Suspense>
  );
}
