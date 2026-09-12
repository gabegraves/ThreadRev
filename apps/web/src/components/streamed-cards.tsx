import React from "react";

// Tool arguments arrive incrementally, before schema defaults are applied.
export interface IncidentCardProps {
  headline?: string;
  summary?: string;
  facts?: Array<{ label?: string; value?: string } | null> | null;
  nextSteps?: Array<string | null> | null;
  tone?: string;
}

export interface TimelineProps {
  title?: string;
  columns?: Array<string | null> | null;
  rows?: Array<Array<string | null> | null> | null;
}

// These cards render INSIDE the CopilotKit chat, which declares its own
// `--muted` and `--accent` on `[data-copilotkit]` — both quiet surfaces there,
// not a text grey and an ink colour. Reading either from in here picks up the
// chat's near-white values and the stripe disappears. The tokens below are the
// ones app/globals.css owns outright, so they resolve the same everywhere and
// flip correctly between light and dark.
const toneColor = {
  neutral: "var(--subtle)",
  good: "var(--status-success-fg)",
  attention: "var(--status-warning-fg)",
} as const;

export function IncidentCard({ headline, summary, facts, nextSteps, tone }: IncidentCardProps) {
  const color = tone === "good" || tone === "attention" ? toneColor[tone] : toneColor.neutral;
  return (
    <article className="ck-card" style={{ borderLeftColor: color }}>
      <h3>{headline || "Preparing incident assessment…"}</h3>
      <p>{summary || "Gathering incident details…"}</p>
      {!!facts?.length && (
        <dl className="ck-facts">
          {facts.map((fact, index) => (
            <div key={index}>
              <dt>{fact?.label || "Loading…"}</dt>
              <dd>{fact?.value || "Loading…"}</dd>
            </div>
          ))}
        </dl>
      )}
      {!!nextSteps?.length && (
        <ul className="ck-steps">
          {nextSteps.map((step, index) => (
            <li key={index}>{step || "Loading…"}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function Timeline({ title, columns, rows }: TimelineProps) {
  return (
    <article className="ck-card">
      {title && <h3>{title}</h3>}
      {!columns?.length ? (
        <p>Preparing timeline…</p>
      ) : (
        <div className="ck-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((header, index) => (
                  <th key={index}>{header || "Loading…"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!rows?.length ? (
                <tr><td colSpan={columns.length}>Loading events…</td></tr>
              ) : rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((_, cellIndex) => (
                    <td key={cellIndex}>{row?.[cellIndex] ?? "Loading…"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
