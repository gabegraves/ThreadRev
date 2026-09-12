"use client";

import { useMemo } from "react";
import { useAgentContext, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import type { Finding } from "agent-core/shared";
import { useEvidence } from "./use-evidence";
import { threadMessages } from "./graph-utils";
import { ThreadView } from "./thread-view";
import { ConsoleDrawer } from "./console-drawer";

export function ReviewConsole() {
  const { graph, events, sample, skipped, source, error } = useEvidence();
  const messages = useMemo(() => threadMessages(events), [events]);

  // A card sits after the message that triggered its run; fallback is the last message.
  const cardsByTs = useMemo(() => {
    const map = new Map<string, Finding[]>();
    const last = messages[messages.length - 1]?.ts;
    for (const ev of events) {
      if (ev.kind !== "finding_published") continue;
      const key = ev.trigger_ts && messages.some((m) => m.ts === ev.trigger_ts) ? ev.trigger_ts : last;
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), ev.finding]);
    }
    return map;
  }, [events, messages]);

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
    <main className="ck-workspace ck-tr-workspace">
      <header className="ck-workspace-header">
        <div>
          <p className="ck-eyebrow">ThreadRev · Review console</p>
          <h1>Precharge review thread</h1>
          <p className="ck-intro">
            Thread <code>{graph.thread}</code> · {messages.length} messages · {graph.findings.length} findings
            {skipped > 0 && <> · {skipped} events skipped</>}
          </p>
        </div>
        <div className="ck-tr-badges">
          {sample && <span className="ck-tag">Sample data</span>}
          <span className="ck-status" data-status={source === "api" && !error ? "live" : "error"}>
            {source === "api" ? (error ? "api stale" : "live") : "inline sample"}
          </span>
        </div>
      </header>
      <section className="ck-panel ck-tr-thread-panel" aria-label="Thread">
        <ThreadView messages={messages} graph={graph} cardsByTs={cardsByTs} />
      </section>
      <ConsoleDrawer graph={graph} events={events} />
    </main>
  );
}
