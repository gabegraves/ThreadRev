import type { StatusTone } from "@/civic-ui/lib/status";

/** finding.status / graphNode.status → Civic tone. Hue is state only. */
export const STATUS_TONE: Record<"live" | "stale" | "refused" | "neutral" | "clean" | "question", StatusTone> = {
  live: "success",
  stale: "warning",
  refused: "danger",
  neutral: "neutral",
  clean: "success",
  question: "info",
};

export const STATUS_LABEL: Record<keyof typeof STATUS_TONE, string> = {
  live: "Live",
  stale: "Stale",
  refused: "Refused",
  neutral: "—",
  clean: "Clean",
  question: "Needs decision",
};

/** Slack-side accent hues from apps/channel/src/finding-card.tsx, kept for parity. */
export const CARD_ACCENT = { finding: "#8A5C10", clean: "#2E7D5B", question: "#1F5FBF", stale: "#5B6478" } as const;

export function cardKind(f: { status: string; discrepancy: string; question?: unknown }): keyof typeof CARD_ACCENT {
  if (f.status === "stale") return "stale";
  if (f.discrepancy === "none") return "clean";
  if (f.question) return "question";
  return "finding";
}

/** Slack permalink for a message ts inside a fixture channel. Inert under Path B. */
export function slackPermalink(channelId: string, ts: string): string {
  return `https://slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
}
