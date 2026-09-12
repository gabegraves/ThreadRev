/**
 * The finding card. Rendered only by publish_result, never by the model
 * directly, so every number on it came from the checker.
 *
 * One tree renders as Slack Block Kit. Keep it scannable: discrepancy first,
 * then why it matters, then evidence, then what closes it.
 */
import {
  Message,
  Header,
  Section,
  Markdown,
  Fields,
  Field,
  Context,
  Divider,
} from "@copilotkit/channels";
import type { Finding } from "agent-core/shared";

const ACCENT = {
  finding: "#8A5C10",
  clean: "#2E7D5B",
  question: "#1F5FBF",
  stale: "#5B6478",
} as const;

function accentFor(f: Finding) {
  if (f.status === "stale") return ACCENT.stale;
  if (f.discrepancy === "none") return ACCENT.clean;
  if (f.question) return ACCENT.question;
  return ACCENT.finding;
}

function headline(f: Finding) {
  if (f.status === "stale") return "Superseded finding";
  if (f.discrepancy === "none") return "Review check: reproduces";
  if (f.question) return "Review check: needs a decision";
  return "Review check: discrepancy";
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function reproducedLines(f: Finding) {
  return f.reproduced.map((r) => {
    const printed = r.printed === undefined ? "" : ` (printed ${fmt(r.printed)}`;
    const verdict =
      r.matches === undefined ? "" : r.matches ? ", reproduces)" : ", does not reproduce)";
    return `• ${r.label}: ${fmt(r.computed)} ${r.unit}${printed}${verdict}`;
  });
}

function sourceLines(f: Finding) {
  return f.sources.map((s) => {
    const where = [s.id, s.revision, s.locator].filter(Boolean).join(" · ");
    const hash = s.sha256 ? ` \`${s.sha256.slice(0, 12)}\`` : "";
    const quote = s.quote ? `\n  > ${s.quote}` : "";
    return `• ${s.kind === "message" ? "msg " : ""}${where}${hash}${quote}`;
  });
}

export function renderFindingCard(f: Finding) {
  const stale = f.status === "stale";
  return (
    <Message accent={accentFor(f)}>
      <Header>{headline(f)}</Header>
      {stale && (
        <Context>
          {`This card was computed against revision ${f.requirements_revision} and has been superseded. Kept for the record; do not act on it.`}
        </Context>
      )}
      {!stale && f.supersedes_reason && (
        <Context>{f.supersedes_reason}</Context>
      )}
      <Section>
        <Markdown>{f.discrepancy === "none" ? "*No discrepancy found.*" : `*${f.discrepancy}*`}</Markdown>
      </Section>
      <Section>
        <Markdown>{`*Why it matters*\n${f.why_it_matters}`}</Markdown>
      </Section>
      {f.reproduced.length > 0 && (
        <Section>
          <Markdown>{`*Reproduced by checker*\n${reproducedLines(f).join("\n")}`}</Markdown>
        </Section>
      )}
      {f.inferred.length > 0 && (
        <Section>
          <Markdown>{`*Inferred, not recomputed*\n${f.inferred.map((i) => `• ${i}`).join("\n")}`}</Markdown>
        </Section>
      )}
      {f.evidence_notices && f.evidence_notices.length > 0 && (
        <Section>
          <Markdown>{`*Noticed in the evidence*\n${f.evidence_notices.map((n) => `• ${n}`).join("\n")}`}</Markdown>
        </Section>
      )}
      <Section>
        <Markdown>{`*Sources*\n${sourceLines(f).join("\n")}`}</Markdown>
      </Section>
      {f.question && (
        <Section>
          <Markdown>{`*Question for ${f.question.to}*\n${f.question.ask}`}</Markdown>
        </Section>
      )}
      <Fields>
        <Field label="Resolves it">{f.resolution}</Field>
        <Field label="Bound to revision">{f.requirements_revision}</Field>
      </Fields>
      <Divider />
      <Context>
        {`${f.checker_run.checker} v${f.checker_run.version} · run ${f.checker_run.run_id} · ${f.finding_id}${
          f.supersedes ? ` · supersedes ${f.supersedes}` : ""
        } · checks passed against stated inputs, not a design sign-off`}
      </Context>
    </Message>
  );
}

/** Posted when the bot is invited to a channel. Says what it will and will not do. */
export function reviewerWelcome(platform: string) {
  return (
    <Message accent="#8A5C10">
      <Header>ThreadRev is in this channel</Header>
      <Section>
        <Markdown>
          {"I read every message here on " + platform +
            ". When a document, revision, or request disagrees with what this thread already decided, I post one card with the discrepancy, the evidence, and what would resolve it. Every number on a card is recomputed by a checker, not by me."}
        </Markdown>
      </Section>
      <Fields>
        <Field label="I will">Recompute printed results, cite the exact line, mark my own card stale when inputs change</Field>
        <Field label="I won't">Recommend component values, sign off a design, or post when there is nothing to say</Field>
        <Field label="Tell me to stop">Say "reviewer, stand down" and I'll go quiet in that thread. "reviewer, resume" brings me back, and @-mentioning me works either way.</Field>
        <Field label="Check my work">Say "reviewer, show your work" and I'll post what I read, what I ran, and anything I refused to publish.</Field>
      </Fields>
    </Message>
  );
}
