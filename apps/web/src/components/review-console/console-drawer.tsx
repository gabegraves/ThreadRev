"use client";

import { useEffect, useState } from "react";
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import { IssuesTab } from "./issues-tab";
import { DiffsTab } from "./diffs-tab";
import { EvidenceTab } from "./evidence-tab";
import { ChatTab } from "./chat-tab";

const TABS = ["Issues", "Diffs", "Evidence", "Chat"] as const;
type Tab = (typeof TABS)[number];

export function ConsoleDrawer({ graph, events }: { graph: EvidenceGraph; events: EvidenceEvent[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("Issues");
  const live = graph.findings.filter((f) => f.status === "live").length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="ck-tr-pill" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="ck-tr-drawer">
        ThreadRev · {live} {live === 1 ? "issue" : "issues"}
      </button>
      <aside id="ck-tr-drawer" className={`ck-tr-drawer${open ? " is-open" : ""}`} aria-label="ThreadRev console" aria-hidden={!open}>
        <header className="ck-tr-drawer-head">
          <nav className="ck-tr-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </nav>
          <button type="button" className="ck-btn ck-btn--tiny" onClick={() => setOpen(false)} aria-label="Close console">
            Esc
          </button>
        </header>
        <div className="ck-tr-drawer-body" role="tabpanel">
          {open && tab === "Issues" && <IssuesTab graph={graph} />}
          {open && tab === "Diffs" && <DiffsTab graph={graph} events={events} />}
          {open && tab === "Evidence" && <EvidenceTab graph={graph} events={events} />}
          {tab === "Chat" && <ChatTab />}
        </div>
      </aside>
    </>
  );
}
