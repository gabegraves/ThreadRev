import type { EvidenceEvent } from "agent-core/shared";
import type { StatusTone } from "@/civic-ui/lib/status";

export type EditProposedEvent = Extract<EvidenceEvent, { kind: "edit_proposed" }>;
export type EditDecidedEvent = Extract<EvidenceEvent, { kind: "edit_decided" }>;
export type EditAppliedEvent = Extract<EvidenceEvent, { kind: "edit_applied" }>;

export type EditProposal = {
  proposal_id: string;
  run_id: string;
  finding_id?: string;
  document: string;
  source_sha256: string;
  edits: EditProposedEvent["edits"];
  decision?: "approved" | "rejected";
  by?: string;
  decided_at?: string;
  applied?: { output: string; sha256: string; error?: string; at: string };
};

/** Joins edit_proposed / edit_decided / edit_applied by proposal_id into one row per proposal. */
export function proposalsFor(
  events: EvidenceEvent[],
  filter: { run_id?: string; finding_id?: string; document?: string },
): EditProposal[] {
  const decided = events.filter((e): e is EditDecidedEvent => e.kind === "edit_decided");
  const applied = events.filter((e): e is EditAppliedEvent => e.kind === "edit_applied");

  return events
    .filter((e): e is EditProposedEvent => e.kind === "edit_proposed")
    .filter((p) => {
      if (filter.run_id && p.run_id !== filter.run_id) return false;
      if (filter.finding_id && p.finding_id !== filter.finding_id) return false;
      if (filter.document && p.document !== filter.document) return false;
      return true;
    })
    .map((p) => {
      const d = decided.find((e) => e.proposal_id === p.proposal_id);
      const a = applied.find((e) => e.proposal_id === p.proposal_id);
      return {
        proposal_id: p.proposal_id,
        run_id: p.run_id,
        finding_id: p.finding_id,
        document: p.document,
        source_sha256: p.source_sha256,
        edits: p.edits,
        decision: d?.decision,
        by: d?.by,
        decided_at: d?.at,
        applied: a ? { output: a.output, sha256: a.sha256, error: a.error, at: a.at } : undefined,
      };
    })
    .sort((x, y) => x.proposal_id.localeCompare(y.proposal_id));
}

/** proposed → approved/rejected → applied/error, in that priority order. */
export function proposalStatus(p: EditProposal): { label: string; tone: StatusTone } {
  if (p.applied?.error) return { label: "error", tone: "danger" };
  if (p.applied) return { label: "applied", tone: "success" };
  if (p.decision === "approved") return { label: "approved", tone: "success" };
  if (p.decision === "rejected") return { label: "rejected", tone: "danger" };
  return { label: "proposed", tone: "info" };
}
