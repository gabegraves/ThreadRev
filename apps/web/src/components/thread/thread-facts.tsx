"use client";

import type { EvidenceGraph } from "agent-core/shared";
import { DetailPanel, DetailSection, Field, FieldGrid } from "@/civic-ui/components/DetailPanel";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { STATUS_LABEL, STATUS_TONE, cardKind } from "@/lib/demo/status";
import type { ThreadModel } from "./thread-model";

export function ThreadFacts({
  model,
  graph,
  channel,
  onOpen,
}: {
  model: ThreadModel;
  graph: EvidenceGraph;
  channel: string | null;
  onOpen: (id: string) => void;
}) {
  const engineers = [...new Set(model.messages.filter((m) => !m.is_bot).map((m) => m.from))];
  const changes = model.messages.filter((m) => m.is_change).length;
  const live = graph.findings.filter((f) => f.status === "live");
  const stale = graph.findings.length - live.length;
  return (
    <DetailPanel title="Thread facts" subtitle="Every number below is counted from evidence events." className="lg:sticky lg:top-4 lg:self-start">
      <FieldGrid>
        <Field label="Channel" value={channel ?? "—"} />
        <Field label="Thread ts" value={graph.thread || "—"} mono />
        <Field label="Messages" value={model.messages.length} />
        <Field label="Runs" value={model.triggers.size} hint="distinct trigger messages" />
        <Field label="Change messages" value={changes} />
        <Field label="Cards" value={`${live.length} live · ${stale} stale`} />
      </FieldGrid>
      <DetailSection title="Engineers present">
        {engineers.length === 0 ? (
          <p className="text-[12px] text-faint">—</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {engineers.map((name) => (
              <li key={name} className="rounded-[var(--radius-sm)] border border-hairline bg-overlay px-2 py-0.5 text-[12px] text-foreground">
                {name}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
      <DetailSection title="Reviewer's live cards">
        {live.length === 0 ? (
          <p className="text-[12px] text-faint">No live card. The reviewer has nothing standing on this thread.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {live.map((f) => {
              const kind = cardKind(f);
              const key = kind === "finding" ? "live" : kind;
              return (
                <li key={f.finding_id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <StatusPill tone={STATUS_TONE[key]}>{STATUS_LABEL[key]}</StatusPill>
                    <button type="button" onClick={() => onOpen(f.finding_id)} className="font-mono text-[11px] text-accent-text underline-offset-2 hover:underline">
                      {f.finding_id}
                    </button>
                  </div>
                  <p className="text-[12.5px] leading-snug text-subtle">{f.discrepancy === "none" ? "No discrepancy found." : f.discrepancy}</p>
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>
    </DetailPanel>
  );
}
