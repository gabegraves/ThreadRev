"use client";

/**
 * The web rendering of a finding card. Same field order as the Slack card in
 * apps/channel/src/finding-card.tsx so the video can cut between surfaces:
 * headline → stale notice → discrepancy → why it matters → reproduced →
 * inferred → sources → question → resolves it / bound to → checker run.
 *
 * `reproduced` and `inferred` are visually separate blocks: that split is the
 * product claim. Never compute or reformat a number beyond display precision.
 */
import type { Finding, ReproducedValue } from "agent-core/shared";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { cn } from "@/civic-ui/lib/cn";
import { STATUS_LABEL, STATUS_TONE, cardKind } from "@/lib/demo/status";

export type FindingCardProps = {
  finding: Finding;
  /** Inline in the thread: discrepancy + reproduced only, rest behind the Findings page. */
  compact?: boolean;
  /** Called when the reader wants the full card (Findings page detail). */
  onOpen?: (findingId: string) => void;
  className?: string;
};

export function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

/** Mirrors headline() in the Slack card. */
export function headline(f: Finding) {
  if (f.status === "stale") return "Superseded finding";
  if (f.discrepancy === "none") return "Review check: reproduces";
  if (f.question) return "Review check: needs a decision";
  return "Review check: discrepancy";
}

function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h4 className={cn("font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-faint", className)}>{children}</h4>;
}

function ReproducedRow({ r }: { r: ReproducedValue }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 font-mono text-[12px]">
      <span className="inline-flex items-center gap-1.5 text-subtle">
        {r.matches !== undefined && (
          <span
            aria-label={r.matches ? "reproduces" : "does not reproduce"}
            title={r.matches ? "reproduces" : "does not reproduce"}
            className={cn("size-1.5 shrink-0 rounded-full", r.matches ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]")}
          />
        )}
        {r.label}
      </span>
      <span className="tabular-nums text-foreground">
        {r.printed !== undefined && <span className="text-faint">printed {fmt(r.printed)} → </span>}
        {fmt(r.computed)} {r.unit}
        {r.tolerance !== undefined && <span className="text-faint"> ±{fmt(r.tolerance)}</span>}
      </span>
    </li>
  );
}

export function FindingCard({ finding: f, compact = false, onOpen, className }: FindingCardProps) {
  const kind = cardKind(f);
  const toneKey = kind === "finding" ? "live" : kind;
  const stale = f.status === "stale";
  return (
    <article
      aria-label="Reviewer finding"
      data-kind={kind}
      className={cn("rounded-[var(--radius-lg)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]", stale && "opacity-80", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill tone={STATUS_TONE[toneKey]}>{STATUS_LABEL[toneKey]}</StatusPill>
          {!compact && <span className="text-[12px] font-medium text-subtle">{headline(f)}</span>}
        </div>
        <code className="font-mono text-[11px] text-faint">{f.finding_id}</code>
      </header>

      {stale && !compact && (
        <p className="mt-3 rounded-[var(--radius-md)] border border-hairline bg-overlay px-3 py-2 text-[12px] text-subtle">
          This card was computed against revision <code className="font-mono">{f.requirements_revision}</code> and has been superseded. Kept for the record; do not act on it.
        </p>
      )}

      <p className="mt-2 text-[13.5px] font-medium leading-snug text-foreground">{f.discrepancy === "none" ? "No discrepancy found." : f.discrepancy}</p>

      {!compact && (
        <section className="mt-3">
          <MicroLabel>Why it matters</MicroLabel>
          <p className="mt-1 text-[13px] leading-relaxed text-subtle">{f.why_it_matters}</p>
        </section>
      )}

      {f.reproduced.length > 0 && (
        <section className="mt-3">
          {!compact && <MicroLabel>Reproduced by checker</MicroLabel>}
          <ul className={cn("flex flex-col gap-1", !compact && "mt-1.5")}>
            {f.reproduced.map((r) => (
              <ReproducedRow key={r.label} r={r} />
            ))}
          </ul>
        </section>
      )}

      {!compact && f.inferred.length > 0 && (
        <section className="mt-3 border-l-2 border-hairline-strong pl-3">
          <MicroLabel>Inferred, not recomputed</MicroLabel>
          <ul className="mt-1 flex flex-col gap-1 text-[12.5px] italic leading-relaxed text-subtle">
            {f.inferred.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      )}

      {!compact && (
        <section className="mt-3">
          <MicroLabel>Sources</MicroLabel>
          <ul className="mt-1.5 flex flex-col gap-2">
            {f.sources.map((s, i) => (
              <li key={`${s.kind}-${s.id}-${i}`} className="text-[12px]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="rounded-[var(--radius-sm)] border border-hairline bg-overlay px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle">
                    {s.kind}
                  </span>
                  <code className="font-mono text-foreground">{s.id}</code>
                  {s.revision && <code className="font-mono text-subtle">{s.revision}</code>}
                  {s.sha256 && (
                    <code className="font-mono text-faint" title={s.sha256}>
                      {s.sha256.slice(0, 12)}
                    </code>
                  )}
                  {s.locator && <span className="text-subtle">· {s.locator}</span>}
                </div>
                {s.quote && (
                  <blockquote className="mt-1 border-l-2 border-hairline pl-2.5 text-[12.5px] leading-relaxed text-subtle">{s.quote}</blockquote>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact && f.question && (
        <section className="mt-3 rounded-[var(--radius-md)] bg-accent-soft px-3 py-2.5">
          <MicroLabel>Question for {f.question.to}</MicroLabel>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground">{f.question.ask}</p>
        </section>
      )}

      {!compact && (
        <section className="mt-3 grid grid-cols-1 gap-3 border-t border-hairline pt-3 sm:grid-cols-2">
          <div className="min-w-0">
            <MicroLabel>Resolves it</MicroLabel>
            <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">{f.resolution}</p>
          </div>
          <div className="min-w-0">
            <MicroLabel>Bound to revision</MicroLabel>
            <code className="mt-1 block break-all font-mono text-[12.5px] tabular-nums text-foreground">{f.requirements_revision}</code>
          </div>
        </section>
      )}

      {!compact && (
        <footer className="mt-3 border-t border-hairline pt-2.5 font-mono text-[10.5px] leading-relaxed text-faint">
          <span>
            {f.checker_run.checker} v{f.checker_run.version} · run {f.checker_run.run_id} · {f.finding_id}
            {f.supersedes && <> · supersedes {f.supersedes}</>}
          </span>
          <span className="block">checks passed against stated inputs, not a design sign-off</span>
        </footer>
      )}

      {compact && onOpen && (
        <button type="button" onClick={() => onOpen(f.finding_id)} className="mt-3 text-[12px] font-medium text-accent-text underline-offset-2 hover:underline">
          Full card
        </button>
      )}
    </article>
  );
}
