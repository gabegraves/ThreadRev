"use client";

import { useMemo } from "react";
import { useAgentContext, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { Card } from "@/civic-ui/components/Card";
import { PageHeader } from "@/components/shell/page-header";
import { ChatTab } from "@/components/review-console/chat-tab";
import { threadMessages } from "@/components/review-console/graph-utils";
import { useEvidence } from "@/lib/demo/use-evidence";

export default function Page() {
  const { graph, events, sample } = useEvidence();
  const messages = useMemo(() => threadMessages(events), [events]);

  // Same context shape as review-console.tsx so the agent sees the current scenario.
  useAgentContext({
    description:
      "ThreadRev review console. The reviewed Slack thread, the findings the reviewer published (live and stale), and which finding supersedes which. Numbers in `reproduced` were recomputed by a checker; never recompute or invent numbers. Answer 'what changed and why' from the change messages, requirements_revision, and supersedes links.",
    value: {
      thread: graph.thread,
      sample,
      messages,
      findings: graph.findings,
      supersessions: graph.findings.filter((f) => f.supersedes).map((f) => ({ live: f.finding_id, stale: f.supersedes ?? "" })),
    },
  });

  useConfigureSuggestions(
    {
      suggestions: [
        { title: "What changed and why?", message: "What changed in this thread, and why did the reviewer supersede its earlier finding?" },
        { title: "What blocks sign-off?", message: "Using the live finding, what has to change before the review can be signed?" },
      ],
      available: "before-first-message",
    },
    [],
  );

  return (
    <>
      <PageHeader
        title="Chat"
        subtitle="Ask about the selected thread. The assistant reads the thread, the findings and their supersedes links; it never recomputes a number, it quotes the checker."
      />
      <Card className="flex min-h-[560px] flex-col p-4">
        <p className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
          context · {messages.length} messages · {graph.findings.length} findings · numbers from checker runs only
        </p>
        <ChatTab />
      </Card>
    </>
  );
}
