"use client";

import { Suspense } from "react";
import { FindingsExplorer } from "@/components/findings/findings-explorer";
import { PageHeader } from "@/components/shell/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Findings" subtitle="Every card the reviewer published, in publish order. Reproduced numbers came from a checker; inferred claims did not." />
      <div className="mt-4">
        <Suspense fallback={<p className="text-[13px] text-subtle">Loading findings…</p>}>
          <FindingsExplorer />
        </Suspense>
      </div>
    </>
  );
}
