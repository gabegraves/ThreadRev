"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { RunDetail } from "@/components/runs/run-detail";
import { runRows, RunsTable } from "@/components/runs/runs-table";
import { Scorecard } from "@/components/runs/scorecard";
import { useEvidence } from "@/lib/demo/use-evidence";

export default function Page() {
  const { events, scenarioId, loaded } = useEvidence();
  const rows = useMemo(() => runRows(events), [events]);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = rows.find((r) => r.run.run_id === picked) ?? rows[rows.length - 1] ?? null;

  return (
    <>
      <PageHeader
        title="Checker runs"
        subtitle="Every check_run event in the log, with the finding it published or the revision that refused it. Numbers on cards are copied from these runs; nothing is recomputed here."
      />
      <section className="flex flex-col gap-4">
        <RunsTable rows={loaded ? rows : []} selected={selected?.run.run_id ?? null} onSelect={setPicked} />
        <RunDetail row={selected} />
      </section>
      <section className="flex flex-col gap-3">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">replay scorecard</p>
          <h2 className="mt-1 text-[15px] font-semibold tracking-tight text-foreground">All scenarios</h2>
          <p className="mt-1 max-w-[70ch] text-[13px] text-subtle">
            Counts derived from each fixture&apos;s events. Controls carry a stated rule and a pass/fail; scenario rows show observed facts only.
          </p>
        </div>
        <Scorecard currentId={scenarioId} />
      </section>
    </>
  );
}
