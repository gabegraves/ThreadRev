"use client";

/**
 * Evidence graph page body: canvas (map or columns) on the left filling the
 * page height, node detail on the right. Selecting a node lights it and every
 * node it touches; the panel carries the node's fields, its edges, a local
 * label override + note (this browser only), and — for run / finding nodes —
 * the reviewer run's event timeline.
 */
import { Maximize2, Minimize2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PillGroup } from "@/civic-ui/components/Tile";
import { cn } from "@/civic-ui/lib/cn";
import { EvidenceGraphNetwork, MapLegend } from "@/components/graph/graph-network";
import { EdgeLegend, EvidenceGraphSvg } from "@/components/graph/graph-svg";
import { NodeDetail } from "@/components/graph/node-detail";
import { PageHeader } from "@/components/shell/page-header";
import { useEvidence } from "@/lib/demo/use-evidence";

type GraphView = "columns" | "map";
const VIEW_KEY = "threadrev.graph-view";
const NOTES_KEY = "threadrev.graph-notes";
const LABELS_KEY = "threadrev.graph-labels";

type LocalMap = Record<string, string>;

function readMap(key: string): LocalMap {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as LocalMap;
    }
  } catch {}
  return {};
}

/** {nodeId: text} in localStorage; empty text deletes the entry. Read after
 *  mount so SSR and hydration agree. */
function useLocalMap(key: string): [LocalMap, (id: string, value: string) => void] {
  const [map, setMap] = useState<LocalMap>({});
  useEffect(() => setMap(readMap(key)), [key]);
  const set = useCallback(
    (id: string, value: string) => {
      setMap((prev) => {
        const next = { ...prev };
        if (value.trim()) next[id] = value;
        else delete next[id];
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [key],
  );
  return [map, set];
}

export function GraphExplorer() {
  const [view, setView] = useState<GraphView>("map");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "columns" || saved === "map") setView(saved);
    } catch {}
  }, []);
  const pickView = (v: GraphView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

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

  const [notes, setNote] = useLocalMap(NOTES_KEY);
  const [labels, setLabel] = useLocalMap(LABELS_KEY);
  const noted = useMemo(() => new Set(Object.keys(notes)), [notes]);
  const hasEdits = noted.size > 0 || Object.keys(labels).length > 0;

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
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void stageRef.current?.requestFullscreen().catch(() => {});
    }
  };

  return (
    // Same full-bleed frame as findings/page.tsx: height is 100dvh divided back
    // out of the html zoom; the header sits inside so the body gets the rest.
    <div className="-mx-3 -mb-10 -mt-[calc(env(safe-area-inset-top)+8rem)] flex h-[calc(100dvh/var(--app-zoom,1)-5.5rem)] min-h-[480px] w-auto flex-col overflow-hidden sm:-mx-4 md:-mt-8 md:h-[calc(100dvh/var(--app-zoom,1))] lg:-mx-6">
      <div className="px-3 pt-4 pb-3 sm:px-4 lg:px-6">
        <PageHeader
          title="Evidence graph"
          subtitle="Built from the append-only event log by agent-core. Click a node to inspect what the log recorded and light everything it touches."
        />
      </div>

      <div ref={stageRef} className="flex min-h-0 flex-1 flex-col border-t border-hairline bg-background">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-3 py-2 sm:px-4 lg:px-6">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {hasEdits && (
              <span
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-hairline bg-overlay px-2.5 py-1 text-[11px] font-medium text-[var(--status-warning-fg)]"
                title="Labels and notes are stored in this browser only. Changes are not saved to the database."
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
                Edits not saved to database
              </span>
            )}
            <PillGroup<GraphView> options={[{ value: "columns", label: "Columns" }, { value: "map", label: "Map" }]} value={view} onChange={pickView} />
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
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4 lg:px-6">
            <div className={cn("min-h-0 flex-1", view === "columns" && "overflow-y-auto custom-scrollbar")}>
              {view === "map" ? (
                <EvidenceGraphNetwork graph={graph} selected={selected} onSelect={select} labels={labels} noted={noted} />
              ) : (
                <EvidenceGraphSvg graph={graph} selected={selected} onSelect={select} labels={labels} noted={noted} />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              {view === "map" ? <MapLegend /> : <EdgeLegend />}
            </div>
          </section>

          <aside className="custom-scrollbar hidden w-[360px] shrink-0 overflow-y-auto border-l border-hairline bg-surface lg:block">
            <NodeDetail
              graph={graph}
              events={events}
              node={node}
              onPick={select}
              className="min-h-full rounded-none border-0 shadow-none"
              label={node ? labels[node.id] : undefined}
              note={node ? notes[node.id] : undefined}
              onSaveLabel={setLabel}
              onSaveNote={setNote}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
