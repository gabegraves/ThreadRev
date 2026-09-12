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
import Link from "next/link";
import type { Finding, ReproducedValue } from "agent-core/shared";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { cn } from "@/civic-ui/lib/cn";
import { LINK_CLASS, hrefs } from "@/lib/demo/links";
import { STATUS_LABEL, STATUS_TONE, cardKind } from "@/lib/demo/status";

export type FindingCardProps = {
  finding: Finding;
  /** Inline in the thread: discrepancy + reproduced only, rest behind the Findings page. */
  compact?: boolean;
  /** Called when the reader wants the full card (Findings page detail). */
  onOpen?: (findingId: string) => void;
  /** Node ids of the graph on screen; gates "Open in graph". Omitted = the card's own graph, where it is always a node. */
  graphNodeIds?: Set<string>;
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
  return <h4 className={cn("text-[11px] font-semibold uppercase tracking-[0.08em] text-faint", className)}>{children}</h4>;
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

export function FindingCard({ finding: f, compact = false, onOpen, graphNodeIds, className }: FindingCardProps) {
  const kind = cardKind(f);
  const toneKey = kind === "finding" ? "live" : kind;
  const stale = f.status === "stale";
  const inGraph = graphNodeIds ? graphNodeIds.has(f.finding_id) : true;
  return (
    <article
      aria-label="Reviewer finding"
      data-kind={kind}
      className={cn(
        "flex flex-col gap-5 rounded-[var(--radius-lg)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]",
        stale && "opacity-80",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone={STATUS_TONE[toneKey]}>{STATUS_LABEL[toneKey]}</StatusPill>
        <span className="inline-flex items-center gap-2 font-mono text-[11px]">
          {compact && (
            <Link href={hrefs.finding(f.finding_id)} className={cn("whitespace-nowrap text-faint", LINK_CLASS)}>
              {f.finding_id}
            </Link>
          )}
          {!compact && inGraph && (
            <Link href={hrefs.graph(f.finding_id)} className={cn("font-sans", LINK_CLASS)}>
              Open in graph
            </Link>
          )}
        </span>
      </header>

      <p className="text-[15px] font-semibold leading-snug text-foreground">{f.discrepancy === "none" ? "No discrepancy found." : f.discrepancy}</p>

      {!compact && (
        <section className="border-t border-hairline pt-4">
          <MicroLabel>Why it matters</MicroLabel>
          <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-foreground">{f.why_it_matters}</p>
        </section>
      )}

      {f.reproduced.length > 0 && (
        <section className={cn(!compact && "border-t border-hairline pt-4")}>
          {!compact && <MicroLabel>Reproduced by checker</MicroLabel>}
          <ul className={cn("flex flex-col gap-1.5", !compact && "mt-1.5")}>
            {f.reproduced.map((r) => (
              <ReproducedRow key={r.label} r={r} />
            ))}
          </ul>
        </section>
      )}

      {!compact && f.inferred.length > 0 && (
        <section className="border-t border-hairline pt-4">
          <MicroLabel>Inferred, not recomputed</MicroLabel>
          <ul className="mt-1.5 flex flex-col gap-1.5 border-l-2 border-hairline-strong pl-3 text-[12px] italic leading-relaxed text-subtle">
            {f.inferred.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      )}

      {!compact && (
        <section className="border-t border-hairline pt-4">
          <MicroLabel>Sources</MicroLabel>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {f.sources.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the same source can be cited twice with different locators
              <li key={`${s.kind}-${s.id}-${i}`} className="flex items-baseline gap-2 text-[12px]">
                <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-faint">{s.kind === "message" ? "msg" : "doc"}</span>
                {s.kind === "message" ? (
                  <Link href={hrefs.thread(s.id)} className={cn("whitespace-nowrap font-mono", LINK_CLASS)}>
                    {s.id}
                  </Link>
                ) : s.sha256 ? (
                  <Link href={hrefs.document(s.sha256)} title={s.sha256} className={cn("truncate whitespace-nowrap font-mono", LINK_CLASS)}>
                    {s.id}
                  </Link>
                ) : (
                  <code className="truncate font-mono text-foreground">{s.id}</code>
                )}
                {s.revision && <code className="shrink-0 font-mono text-[11px] text-subtle">{s.revision}</code>}
                {s.locator && (
                  <span className="min-w-0 truncate text-subtle" title={s.locator}>
                    {s.locator}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact && f.question && (
        <section className="rounded-[var(--radius-md)] bg-accent-soft px-3 py-2.5">
          <MicroLabel>Question for {f.question.to}</MicroLabel>
          <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-foreground">{f.question.ask}</p>
        </section>
      )}

      {!compact && (
        <section className="grid grid-cols-1 gap-3 border-t border-hairline pt-4 sm:grid-cols-2">
          <div className="min-w-0">
            <MicroLabel>Resolves it</MicroLabel>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{f.resolution}</p>
          </div>
          <div className="min-w-0">
            <MicroLabel>Bound to revision</MicroLabel>
            <Link href={hrefs.thread(f.requirements_revision)} className={cn("mt-1.5 block whitespace-nowrap font-mono text-[12px] tabular-nums text-subtle", LINK_CLASS)}>
              {f.requirements_revision}
            </Link>
          </div>
        </section>
      )}

      {!compact && (
        <footer className="border-t border-hairline pt-3 font-mono text-[11px] leading-relaxed text-faint">
          <span>
            {f.checker_run.checker} v{f.checker_run.version} · run{" "}
            <Link href={hrefs.run(f.checker_run.run_id)} className={LINK_CLASS}>
              {f.checker_run.run_id}
            </Link>{" "}
            ·{" "}
            <Link href={hrefs.finding(f.finding_id)} className={LINK_CLASS}>
              {f.finding_id}
            </Link>
            {f.supersedes && (
              <>
                {" "}
                · supersedes{" "}
                <Link href={hrefs.finding(f.supersedes)} className={LINK_CLASS}>
                  {f.supersedes}
                </Link>
              </>
            )}
          </span>
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
