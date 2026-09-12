"use client";

/**
 * Evidence graph page body: the d3 canvas fills the frame, the node detail
 * sits in a fixed right column. One question: what did this change
 * invalidate. Selecting a node lights it and everything it touches; the panel
 * carries its edges, its logged fields, a local note (this browser only) and
 * — for run / finding nodes — the reviewer run's trace.
 */
import { Maximize2, Minimize2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusPill } from "@/civic-ui/components/StatusPill";
import { EvidenceGraphNetwork, KindLegend } from "@/components/graph/graph-network";
import { NodeDetail } from "@/components/graph/node-detail";
import { PageHeader } from "@/components/shell/page-header";
import { useEvidence } from "@/lib/demo/use-evidence";

const NOTES_KEY = "threadrev.graph-notes";

type Notes = Record<string, string>;

/** {nodeId: text} in localStorage; empty text deletes the entry. Read after
 *  mount so SSR and hydration agree. */
/** Seed notes for the demo thread, shown until this browser saves its own. */
const DEMO_NOTES: Notes = {
  "fnd-a-r2-001": "Card 1. Text 680 uF vs diagram 750 uF. Diagram matched the printed 2.435 s, so the text is the typo.",
  "fnd-a-820-002": "Card 2 supersedes card 1 after Dara's 820 uF correction. 2.66 s > 2.5 s timer; relay closes early.",
  "rc-20260912T153100Z-b21c": "Second rc run. 4 of 7 fail once the bus is 820 uF. Numbers copied to card 2 unchanged.",
  "1787171400.000200": "The correction message. Everything downstream of this ts went stale.",
};

function useNotes(): [Notes, (id: string, value: string) => void] {
  const [map, setMap] = useState<Notes>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : DEMO_NOTES;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setMap(Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Notes);
      }
    } catch {}
  }, []);
  const set = useCallback((id: string, value: string) => {
    setMap((prev) => {
      const next = { ...prev };
      if (value.trim()) next[id] = value;
      else delete next[id];
      try {
        localStorage.setItem(NOTES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  return [map, set];
}

export function GraphExplorer() {
  const { graph, events } = useEvidence();

  // `?node=` ↔ selection. The canvas / panel write the URL through `select`;
  // only an external change (deep link, back / forward) flows back in.
  const router = useRouter();
  const params = useSearchParams();
  const paramNode = params.get("node");
  const selfPushedRef = useRef<string | null>(paramNode);
  const [selected, setSelected] = useState<string | null>(paramNode);
  useEffect(() => {
    if (paramNode !== selfPushedRef.current) {
      selfPushedRef.current = paramNode;
      setSelected(paramNode);
    }
  }, [paramNode]);
  const select = useCallback(
    (id: string | null) => {
      setSelected(id);
      selfPushedRef.current = id;
      router.replace(id ? `/graph?node=${encodeURIComponent(id)}` : "/graph", { scroll: false });
    },
    [router],
  );
  const node = selected ? (graph.nodes.find((n) => n.id === selected) ?? null) : null;

  const [notes, setNote] = useNotes();
  const noted = useMemo(() => new Set(Object.keys(notes)), [notes]);

  // Fullscreen covers the canvas + detail row, so a node picked while
  // fullscreen still shows its panel. Escape exits natively.
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === stageRef.current && stageRef.current !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void stageRef.current?.requestFullscreen().catch(() => {});
  };

  return (
    // Same full-bleed frame as findings/page.tsx: height is 100dvh divided back
    // out of the html zoom; the header sits inside so the body gets the rest.
    <div className="-mx-3 -mb-10 -mt-[calc(env(safe-area-inset-top)+8rem)] flex h-[calc(100dvh/var(--app-zoom,1)-5.5rem)] min-h-[480px] w-auto flex-col overflow-hidden sm:-mx-4 md:-mt-8 md:h-[calc(100dvh/var(--app-zoom,1))] lg:-mx-6">
      <div className="px-3 pt-4 pb-3 sm:px-4 lg:px-6">
        <PageHeader
          title="Evidence graph"
          subtitle="What did this change invalidate?"
          actions={
            <>
              {noted.size > 0 && (
                <span title="Notes are stored in this browser only. They are not saved to the database.">
                  <StatusPill tone="warning">Edits not saved</StatusPill>
                </span>
              )}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-pressed={fullscreen}
                aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-overlay px-2 text-[12px] font-medium text-subtle transition-colors hover:border-hairline-strong hover:text-foreground"
              >
                {fullscreen ? <Minimize2 className="h-3.5 w-3.5" strokeWidth={2} /> : <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} />}
                {fullscreen ? "Exit" : "Full screen"}
              </button>
            </>
          }
        />
      </div>

      <div ref={stageRef} className="flex min-h-0 flex-1 border-t border-hairline bg-background">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <EvidenceGraphNetwork graph={graph} selected={selected} onSelect={select} noted={noted} />
          </div>
          <KindLegend />
        </section>

        <aside className="custom-scrollbar hidden w-[380px] shrink-0 overflow-y-auto border-l border-hairline bg-surface lg:block">
          <NodeDetail graph={graph} events={events} node={node} onPick={select} note={node ? notes[node.id] : undefined} onSaveNote={setNote} />
        </aside>
      </div>
    </div>
  );
}
