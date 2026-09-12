/**
 * Turning a published finding into tracked work.
 *
 * A card scrolls away. A discrepancy that needs a person is work, and work
 * belongs where the team already tracks it — that is the whole reason to reach
 * into the workplace at all.
 *
 * Filed by application code rather than by the model, for the same reason every
 * other consequential step here is: publish_result copies numbers from the
 * checker, the freshness guard is enforced in code, instruction notices bypass
 * the model entirely. A workplace write decided by the model would be the one
 * place that principle did not hold. So this runs after a card is actually
 * posted, carries that card's own provenance, and files exactly one task.
 *
 * Never throws. A workplace that is down, unscoped, or absent must not cost the
 * review that was already published.
 */
import { connect, isWorkplaceConfigured, type Finding, type McpSession } from "agent-core";

const AMBIGUOUS_MCP_URL = "https://app.ambiguous.ai/mcp";

export type FollowupOutcome =
  | { filed: false; reason: string }
  | { filed: true; tool: string; detail: string };

/**
 * Which tool creates a task.
 *
 * Discovered rather than hardcoded: the workplace names its own tools and a
 * guess that is wrong fails at the worst moment. Ordered by how specific the
 * match is, so `tasks_create` wins over a generic `create`.
 */
export function pickTaskTool(names: string[]): string | undefined {
  const score = (n: string): number => {
    const s = n.toLowerCase();
    if (!/creat|add|new/.test(s)) return 0;
    if (/task/.test(s)) return 3;
    if (/issue|ticket|todo/.test(s)) return 2;
    return 0;
  };
  return names
    .map((n) => [n, score(n)] as const)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0];
}

/** One line per source, so the task carries the same provenance the card does. */
function provenance(f: Finding): string {
  return f.sources
    .map((s) => {
      const where = [s.id, s.revision, s.locator].filter(Boolean).join(" · ");
      return `- ${where}${s.sha256 ? ` (sha ${s.sha256.slice(0, 12)})` : ""}`;
    })
    .join("\n");
}

export function followupTitle(f: Finding): string {
  const head = f.discrepancy === "none" ? "Review reproduced, no discrepancy" : f.discrepancy;
  return `ThreadRev: ${head.replace(/\s+/g, " ").slice(0, 110)}`;
}

export function followupBody(f: Finding): string {
  return [
    f.why_it_matters,
    "",
    `What resolves it: ${f.resolution}`,
    f.question ? `Question for ${f.question.to}: ${f.question.ask}` : undefined,
    "",
    `Finding ${f.finding_id}, bound to requirements revision ${f.requirements_revision}.`,
    `Checked by ${f.checker_run.checker} v${f.checker_run.version}, run ${f.checker_run.run_id}.`,
    "",
    "Sources:",
    provenance(f),
    "",
    "Filed by ThreadRev from a posted review card. Checks passed against stated inputs; this is not a design sign-off.",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

export interface FileFollowupOptions {
  /** Injected in tests; defaults to the real workplace. */
  session?: McpSession;
  url?: string;
  apiKey?: string;
}

export async function fileFollowup(f: Finding, options: FileFollowupOptions = {}): Promise<FollowupOutcome> {
  const apiKey = options.apiKey ?? process.env.AMBIGUOUS_API_KEY;
  if (!options.session && !(apiKey && isWorkplaceConfigured())) {
    return { filed: false, reason: "no workplace configured" };
  }
  try {
    const session =
      options.session ?? (await connect({ url: options.url ?? AMBIGUOUS_MCP_URL, apiKey: apiKey!, client: "threadrev" }));
    const tools = await session.listTools();
    const tool = pickTaskTool(tools.map((t) => t.name));
    if (!tool) {
      return { filed: false, reason: `the workplace exposes no task-creating tool (saw ${tools.length})` };
    }
    const result = await session.callTool(tool, {
      title: followupTitle(f),
      description: followupBody(f),
    });
    const detail = result.content?.map((c) => c.text ?? "").join(" ").trim() || "filed";
    return { filed: true, tool, detail: detail.slice(0, 200) };
  } catch (error) {
    // Reported, never thrown: the card is already posted and a workplace that
    // is down must not turn a successful review into a failed one.
    return { filed: false, reason: (error as Error).message.slice(0, 200) };
  }
}
