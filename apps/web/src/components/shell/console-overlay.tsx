"use client";

/**
 * The bottom-right pill and right-hand drawer (Issues, Diffs, Evidence, Chat)
 * from the first review console, mounted once in the Civic layout so it is on
 * every page. It follows the scenario switcher through the shared evidence
 * hook, and registers the scenario as agent context for the drawer's Chat tab
 * on every page except /chat, which registers the same context itself.
 */
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAgentContext } from "@copilotkit/react-core/v2";
import { ConsoleDrawer } from "@/components/review-console/console-drawer";
import { threadMessages } from "@/components/review-console/graph-utils";
import { useEvidence } from "@/lib/demo/use-evidence";

const CONTEXT_DESCRIPTION =
  "ThreadRev review console. The reviewed Slack thread, the findings the reviewer published (live and stale), and which finding supersedes which. Numbers in `reproduced` were recomputed by a checker; never recompute or invent numbers. Answer 'what changed and why' from the change messages, requirements_revision, and supersedes links.";

function ScenarioContext({ graph, events, sample }: ReturnType<typeof useEvidence>) {
  const messages = useMemo(() => threadMessages(events), [events]);
  useAgentContext({
    description: CONTEXT_DESCRIPTION,
    value: {
      thread: graph.thread,
      sample,
      messages,
      findings: graph.findings,
      supersessions: graph.findings.filter((f) => f.supersedes).map((f) => ({ live: f.finding_id, stale: f.supersedes ?? "" })),
    },
  });
  return null;
}

export function ConsoleOverlay() {
  const view = useEvidence();
  const pathname = usePathname();
  return (
    <>
      {pathname !== "/chat" && <ScenarioContext {...view} />}
      <ConsoleDrawer graph={view.graph} events={view.events} />
    </>
  );
}
