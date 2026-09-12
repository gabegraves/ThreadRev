"use client";

import { Clock, ImageOff, MapPin } from "lucide-react";
import { useState } from "react";
import {
  getReasoning,
  type ReasoningResponse,
  type ReasoningSection,
} from "@/lib/civic-adapters/reports";
import type { DashboardReport } from "@/civic/lib/dashboard-data";
import {
  CATEGORY_SLA_TARGETS,
  categoryMeta,
  categorySlaHours,
} from "@/civic/lib/dashboard-data";
import { SEVERITY_HUE } from "@/civic/lib/severity-colors";
import { STATUS_LABEL, statusChipClass } from "@/civic/lib/status";
import type { ReportStatus } from "@/civic/lib/types";
import { cn } from "@/civic-ui/lib/cn";
import { timeAgo } from "@/civic/lib/time-ago";

/* ==================================================================
   Report detail pane — right-hand column of the reports explorer.

   Given a selected report (or null) it renders the photo, an info
   grid, and the AI reasoning (Cost + Scoring). The reasoning payload
   is fetched lazily from /api/ai/reasoning, cached per id so that
   re-selecting a report is instant, and guarded against a slow fetch
   resolving after the user has moved to a different report.

   Helpers (status maps, severity colors, the Stat style) mirror the
   sibling components but are re-implemented locally — the originals
   are module-private and not exported.
   ================================================================== */

// The app-wide ordinal severity ramp (@/lib/severity-colors) — same map the
// analytics donut, the work-order grid and the field view read, so a severity
// chip reads identically everywhere.
const SEVERITY_COLORS = SEVERITY_HUE;

const SEVERITY_DESC: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Clean or one check",
  2: "Two checks",
  3: "Three checks",
  4: "Four checks",
  5: "Every check",
};

function ageDays(iso: string): number {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  return Math.floor(diff / 86_400_000);
}

// CATEGORY_SLA_TARGETS is in hours; show as days. 36h reads as 1.5d.
function formatDays(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}d` : `${rounded.toFixed(1)}d`;
}

function absoluteDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------
   Small Stat helper — mirrors the analytics bento label/value style.
   ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-faint">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[15px] font-medium tabular-nums text-foreground leading-tight underline-offset-2 hover:underline"
          title="Open in Google Maps"
        >
          {value}
        </a>
      ) : (
        <span className="text-[15px] font-medium tabular-nums text-foreground leading-tight">
          {value}
        </span>
      )}
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </div>
  );
}

function StatusPill({ status }: { status: ReportStatus }) {
  return (
    <span
      className={cn(
        "flex-shrink-0 rounded-md px-2 py-0.5 text-[12px] font-medium",
        statusChipClass(status),
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function ReasoningColumn({
  heading,
  sections,
}: {
  heading: string;
  sections: ReasoningSection[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-faint">
        {heading}
      </h4>
      <div className="flex flex-col gap-3">
        {sections.map((s) => (
          <div key={s.title} className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-faint">
              {s.title}
            </span>
            <p className="text-[12px] leading-relaxed text-subtle">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Reasoning fetch — ported from reasoning-hover.tsx, adapted to a
   report-id effect. Per-id cache keeps re-selection instant; a
   `cancelled` flag guards against a slow fetch resolving after the
   selection has changed. Adds an error state the hover card lacks.
   ------------------------------------------------------------------ */

type ReasoningState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; data: ReasoningResponse };

function useReasoning(report: DashboardReport | null): ReasoningState {
  // ThreadRev: reasoning is derived from the evidence log by the adapter, so
  // the lookup is synchronous; loading/error phases are kept for the UI.
  const reportId = report?.id ?? null;
  if (!reportId) return { phase: "loading" };
  const data: ReasoningResponse | undefined = getReasoning(reportId);
  return data ? { phase: "ready", data } : { phase: "error" };
}


/* ==================================================================
   ReportDetail
   ================================================================== */

/** Report photo with a graceful fallback. Some sources (CSP-blocked hosts,
   dead links, missing uploads) won't load; rather than leave a 16:9 void we
   swap in a neutral placeholder. Keyed by report id at the call site so the
   error state resets on every selection. */
function ReportImage({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(!src);

  if (errored) {
    return (
      <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 bg-overlay text-faint">
        <ImageOff className="h-6 w-6" strokeWidth={1.5} aria-hidden />
        <span className="text-[12px]">No attachment recorded</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    // biome-ignore lint/performance/noImgElement: dynamic external/resident photo URL, next/image impractical
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className="aspect-[16/9] w-full object-cover"
    />
  );
}

export function ReportDetail({ report }: { report: DashboardReport | null }) {
  const reasoning = useReasoning(report);

  if (!report) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center p-8 text-center">
        <p className="text-[14px] text-faint">Select a finding</p>
      </div>
    );
  }

  const meta = categoryMeta(report.category);
  const sevColor = SEVERITY_COLORS[report.severity];
  const slaTargetHours = categorySlaHours(report.category);
  const age = ageDays(report.created_at);
  const runId = report.id.split("/").pop() ?? report.id;

  return (
    <div
      key={report.id}
      className="flex flex-col gap-5 sm:gap-7 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
    >
      {/* 1. Image with overlaid severity chip + status pill */}
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-surface">
        <ReportImage
          key={report.id}
          src={report.photo_public_url}
          alt={`${meta.label} report at ${report.address}`}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-md bg-black/40 px-2 py-1 text-[12px] font-medium text-white backdrop-blur-sm"
            style={{
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sevColor} 40%, transparent)`,
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: sevColor }}
              aria-hidden
            />
            {report.severity} failing
          </span>
          <StatusPill status={report.status} />
        </div>
      </div>

      {/* 2. Title row */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2.5 text-[20px] font-semibold tracking-tight text-foreground">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: meta.color }}
              aria-hidden
            />
            <span className="truncate">{meta.label}</span>
          </h2>
          <StatusPill status={report.status} />
        </div>
        <span
          className="group flex items-center gap-1.5 text-[13px] text-subtle"
          title="Primary evidence source"
        >
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} />
          <span className="truncate">{report.address}</span>
        </span>
      </div>

      {/* 3. Info grid */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        <Stat
          label="Failing checks"
          value={`${report.severity} failing`}
          hint={SEVERITY_DESC[report.severity]}
        />
        <Stat label="Status" value={STATUS_LABEL[report.status]} />
        <Stat label="Category" value={meta.label} />
        <Stat label="Engineer" value={report.reporter_id} />
        <Stat
          label="Published"
          value={timeAgo(report.created_at)}
          hint={absoluteDate(report.created_at)}
        />
        <Stat label="Age" value={`${age}d`} />
        <Stat label="SLA target" value={formatDays(slaTargetHours / 24)} />
        <Stat label="Finding id" value={runId} />
        <Stat label="Channel" value={report.assigned_team ?? "None"} />
      </div>

      {/* 4. AI reasoning */}
      <div className="flex flex-col gap-4 border-t border-hairline pt-6">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
            Why it matters
          </h3>
          <span className="rounded-md bg-overlay-strong px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-subtle">
            From evidence
          </span>
        </div>

        {reasoning.phase === "loading" && (
          /* Skeleton mirrors the two-column ReasoningColumn grid so the section
             reserves its real height — no layout shift when data lands. */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[0, 1].map((col) => (
              <div key={col} className="flex flex-col gap-4">
                <div className="h-2.5 w-16 rounded bg-overlay-strong animate-pulse motion-reduce:animate-none" />
                <div className="flex flex-col gap-3">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="flex flex-col gap-1.5">
                      <div className="h-2 w-24 rounded bg-overlay animate-pulse motion-reduce:animate-none" />
                      <div className="h-2.5 w-full max-w-[220px] rounded bg-overlay animate-pulse motion-reduce:animate-none" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {reasoning.phase === "error" && (
          <p className="flex items-center gap-1.5 text-[12px] text-faint">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            No evidence recorded for this finding.
          </p>
        )}

        {reasoning.phase === "ready" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ReasoningColumn
              heading="Checks"
              sections={reasoning.data.costBreakdown}
            />
            <ReasoningColumn
              heading="Finding"
              sections={reasoning.data.scoringExplanation}
            />
          </div>
        )}
      </div>
    </div>
  );
}
