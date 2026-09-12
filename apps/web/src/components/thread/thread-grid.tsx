"use client";

/* Copied from src/civic/grid/work-order-grid.tsx (the Civic port) for the
   thread page. What changed and nothing else:
   - rows are ThreadGridRow (one per thread message), keyed by Slack ts.
   - the columns are read-only: the SelectEditor / onCellValueChanged
     machinery and the "Edits not saved" pill are gone, so every cell click
     opens the explorer. The EditPill affordance (bordered pill + chevron)
     is kept purely for the visual match — chevron doesn't open an editor
     here, the whole cell opens the message.
   - the Issue cell shows author + excerpt with a trigger/change/message glyph,
     Team shows the channel (channelIcon + #channel, like work-order-grid's
     TeamCell but "#"-prefixed since this is a channel not a department), and
     Priority is the reproduced-value bar (row.priority). The Status cell
     falls back to the message role when no card was published. Severity /
     Dept / Crew columns from work-order-grid are dropped: no severity-graded
     column exists on ThreadGridRow beyond the removed one, and dept drives
     the toolbar chips instead of a column.
   - toolbar chips filter by `dept` (trigger/change/message), not status —
     work-order-grid's status chips became Status a plain read-only cell.
   - the explorer is ThreadExplorer (message detail), not WorkOrderExplorer.
   Class strings are unchanged from work-order-grid where reused. */

import {
  AllCommunityModule,
  type CellClickedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  ModuleRegistry,
  type RowClassRules,
  themeQuartz,
  type ValueGetterParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import { Check, ChevronDown, CircleAlert, type LucideIcon, Maximize2, MessageSquare, Search, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/civic-ui/lib/cn";
import { channelIcon } from "@/civic/lib/grid/team-icon";
import { TEAMS } from "@/civic/lib/grid/teams";
import { useTheme } from "@/civic/lib/grid/use-theme";
import type { ThreadGridRow, ThreadRowDept } from "@/lib/civic-adapters/thread-rows";
import type { ThreadModel } from "./thread-model";
import { ThreadExplorer } from "./thread-explorer";

ModuleRegistry.registerModules([AllCommunityModule]);

const DEPT_ICON: Record<ThreadRowDept, LucideIcon> = {
  trigger: Zap,
  change: CircleAlert,
  message: MessageSquare,
};

const DEPTS: ThreadRowDept[] = ["trigger", "change", "message"];
const DEPT_CHIP_LABEL: Record<ThreadRowDept, string> = {
  trigger: "Triggers",
  change: "Changes",
  message: "Bot",
};

const titleize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS_TEXT: Record<string, string> = {
  live: "text-[var(--status-success-fg)]",
  stale: "text-[var(--status-warning-fg)]",
  refused: "text-[var(--status-danger-fg)]",
};

const STATUS_DOT: Record<string, string> = {
  live: "bg-[var(--color-success)]",
  stale: "bg-[var(--color-warning)]",
  refused: "bg-[var(--color-danger)]",
};

// Priority (reproduced-value count) → green→red ramp — copied verbatim from
// work-order-grid's SEVERITY_HUE / priorityHue.
const SEVERITY_HUE: Record<number, string> = {
  1: "var(--status-success-fg)",
  2: "color-mix(in srgb, var(--status-success-fg) 55%, var(--status-warning-fg))",
  3: "var(--status-warning-fg)",
  4: "color-mix(in srgb, var(--status-warning-fg) 50%, var(--status-danger-fg))",
  5: "var(--status-danger-fg)",
};
const PRIORITY_DOMAIN = 5;
function priorityHue(score: number): string {
  if (score <= 0) return SEVERITY_HUE[5];
  if (score === 1) return SEVERITY_HUE[4];
  if (score === 2) return SEVERITY_HUE[3];
  if (score === 3) return SEVERITY_HUE[2];
  return SEVERITY_HUE[1];
}

// ── AG-Grid theme ───────────────────────────────────────────────────────────
const gridThemeLight = themeQuartz.withParams({
  accentColor: "#18181b",
  backgroundColor: "#ffffff",
  headerBackgroundColor: "#ffffff",
  headerTextColor: "#6f6f76",
  headerFontWeight: 600,
  foregroundColor: "#141415",
  fontFamily: "inherit",
  fontSize: 13,
  cellHorizontalPadding: 12,
  rowHoverColor: "rgba(0, 0, 0, 0.04)",
  selectedRowBackgroundColor: "rgba(24, 24, 27, 0.07)",
  borderColor: "rgba(0, 0, 0, 0.08)",
  wrapperBorderRadius: "0px",
  wrapperBorder: false,
});
const gridThemeDark = themeQuartz.withParams({
  accentColor: "#f4f4f5",
  backgroundColor: "#101012",
  headerBackgroundColor: "#101012",
  headerTextColor: "#85858c",
  headerFontWeight: 600,
  foregroundColor: "#ffffff",
  fontFamily: "inherit",
  fontSize: 13,
  cellHorizontalPadding: 12,
  rowHoverColor: "rgba(255, 255, 255, 0.04)",
  selectedRowBackgroundColor: "rgba(255, 255, 255, 0.09)",
  borderColor: "rgba(255, 255, 255, 0.09)",
  wrapperBorderRadius: "0px",
  wrapperBorder: false,
});

// Neutral icon tile for the dept glyph — copied verbatim from work-order-grid.
const ICON_TILE = "text-subtle";
function iconTileStyle(color: string): React.CSSProperties {
  return { color };
}

/** The select-affordance container: bordered pill + chevron. Copied verbatim
 *  from work-order-grid's EditPill for the visual match — every cell here is
 *  read-only, the chevron is chrome only, click still opens the explorer. */
function EditPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-transparent bg-transparent py-1 pl-2 pr-1.5 transition-colors hover:border-hairline-strong hover:bg-overlay",
        className,
      )}
    >
      {children}
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
    </span>
  );
}

// ── cell renderers ──────────────────────────────────────────────────────────

function excerpt(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

/** Issue — dept glyph + bold author ("kind") + muted excerpt ("preview"),
 *  wrapped in the same EditPill affordance as work-order-grid's CategoryCell. */
function IssueCell({ data }: ICellRendererParams<ThreadGridRow>) {
  if (!data) return null;
  const Icon = DEPT_ICON[data.dept];
  return (
    <EditPill className="h-8 pl-1.5">
      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)]", ICON_TILE)}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span className="shrink-0 truncate text-[13px] font-medium text-foreground" title={data.from}>
        {data.from || "—"}
      </span>
      <span className="min-w-0 truncate text-[12px] text-faint" title={data.text}>
        {excerpt(data.text, 120)}
      </span>
    </EditPill>
  );
}

/** Team — the Slack channel this message belongs to. Read-only, same icon
 *  tile as work-order-grid's TeamCell, "#channel" text per the findings
 *  parity spec (work-order-grid shows the full department label instead). */
function TeamCell({ data }: ICellRendererParams<ThreadGridRow>) {
  if (!data) return null;
  const team = TEAMS[data.team_key] ?? TEAMS.general_admin;
  const Icon = channelIcon(data.team_label);
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-md)]" style={iconTileStyle(team.color)}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="truncate text-[13px] text-subtle">#{data.team_label}</span>
    </span>
  );
}

/** Priority — reproduced-value count + proportional bar. Copied verbatim from
 *  work-order-grid's PriorityCell, reading ThreadGridRow's `priority` field. */
function PriorityCell({ data }: ICellRendererParams<ThreadGridRow>) {
  if (!data) return null;
  if (data.priority == null) return <span className="text-faint">—</span>;
  const score = data.priority;
  const pct = Math.max(4, Math.min(100, (score / PRIORITY_DOMAIN) * 100));
  const hue = priorityHue(score);
  return (
    <span className="flex items-center gap-2">
      <span className="tabular-nums text-[13px] font-semibold" style={{ color: hue }}>
        {score}
      </span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-elevated">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: hue }} />
      </span>
    </span>
  );
}

function StatusCell({ data }: ICellRendererParams<ThreadGridRow>) {
  if (!data) return null;
  if (!data.status) return <span className="pl-2.5 text-[13px] text-faint">{data.dept}</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="inline-flex h-8 items-center gap-1.5 py-1 pl-2.5 pr-1.5">
        <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[data.status] ?? STATUS_DOT.live)} />
        <span className={cn("text-[13px] font-medium capitalize", STATUS_TEXT[data.status] ?? STATUS_TEXT.live)}>{data.status}</span>
      </span>
      {data.cards > 1 && (
        <span
          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-hairline bg-overlay px-1.5 py-0.5 text-[11px] font-medium text-subtle"
          title={`${data.cards} cards published under this message`}
        >
          {data.cards} cards
        </span>
      )}
    </span>
  );
}

/** Reported — mono time cell, same treatment as workspace-grid's TimeCell. */
function TimeCell({ data }: ICellRendererParams<ThreadGridRow>) {
  if (!data) return null;
  const d = new Date(data.at);
  if (Number.isNaN(d.getTime())) return <span className="text-faint">—</span>;
  const formatted = d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span className="font-mono text-[12px] tabular-nums text-foreground" title={data.at}>
      {formatted}
    </span>
  );
}

function ExpandCell({ data, context }: ICellRendererParams<ThreadGridRow>) {
  if (!data) return null;
  const { openDetail } = context as { openDetail: (id: string) => void };
  return (
    <button
      type="button"
      onClick={() => openDetail(data.ts)}
      aria-label={`Open details for message ${data.ts}`}
      title="Open full details"
      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-transparent text-faint outline-none transition-colors hover:border-hairline hover:bg-overlay hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <Maximize2 className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

// ── Page-size control ────────────────────────────────────────────────────────
type PageChoice = 25 | 50 | 100 | "all";
const PAGE_CHOICES: PageChoice[] = [25, 50, 100, "all"];
const pageChoiceLabel = (c: PageChoice) => (c === "all" ? "All" : String(c));

function PageSizeSelect({ value, onChange }: { value: PageChoice; onChange: (c: PageChoice) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Rows per page: ${pageChoiceLabel(value)}`}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-hairline bg-overlay px-2.5 py-1 text-xs font-medium text-subtle outline-none transition-colors hover:border-hairline-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span className="text-faint">Rows</span>
        <span className="tabular-nums text-foreground">{pageChoiceLabel(value)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 bottom-full z-30 mb-1.5 w-28 overflow-hidden rounded-[var(--radius-md)] border border-hairline bg-surface p-1 shadow-[var(--shadow-pop)]"
        >
          {PAGE_CHOICES.map((c) => {
            const selected = c === value;
            return (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-overlay",
                  selected && "font-medium",
                )}
              >
                <span className="tabular-nums">{pageChoiceLabel(c)}</span>
                {selected && <Check className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ThreadGrid({
  rows,
  model,
  graph,
  events,
  channelId,
  onOpenFinding,
  focusTs = null,
  onSelectedChange,
}: {
  rows: ThreadGridRow[];
  model: ThreadModel;
  graph: EvidenceGraph;
  events: EvidenceEvent[];
  channelId: string | null;
  onOpenFinding: (id: string) => void;
  /** Deep link (`?ts=`): land on this message and open its detail. */
  focusTs?: string | null;
  /** Fires with the open message's ts, or null when the explorer closes. */
  onSelectedChange?: (ts: string | null) => void;
}) {
  const { theme } = useTheme();
  const gridTheme = theme === "dark" ? gridThemeDark : gridThemeLight;

  const gridApiRef = useRef<GridApi<ThreadGridRow> | null>(null);

  const gridWrapRef = useRef<HTMLDivElement>(null);
  const [pagingSlot, setPagingSlot] = useState<HTMLElement | null>(null);
  const mountPagingSlot = useCallback(() => {
    const panel = gridWrapRef.current?.querySelector<HTMLElement>(".ag-paging-panel");
    if (!panel) return;
    const pageNav = panel.querySelector<HTMLElement>(".ag-paging-page-summary-panel");
    let host = panel.querySelector<HTMLElement>(":scope > .civic-page-size-slot");
    if (!host) {
      host = document.createElement("div");
      host.className = "civic-page-size-slot";
    }
    if (pageNav && host.nextElementSibling !== pageNav) {
      panel.insertBefore(host, pageNav);
    }
    setPagingSlot((prev) => (prev === host ? prev : host));
  }, []);

  const [explorerOpen, setExplorerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const selectId = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      onSelectedChange?.(id);
    },
    [onSelectedChange],
  );
  const openDetail = useCallback(
    (id: string) => {
      selectId(id);
      setExplorerOpen(true);
    },
    [selectId],
  );
  const closeExplorer = useCallback(() => {
    setExplorerOpen(false);
    setDetailDrawerOpen(false);
    selectId(null);
  }, [selectId]);

  // Deep-link focus, as work-order-grid does it: wait for the grid, widen the
  // filters if they hide the row, flag the row for 4 s, open its detail.
  const [gridReady, setGridReady] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(focusTs);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setFocusId(focusTs), [focusTs]);
  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    [],
  );
  const rowClassRules = useMemo<RowClassRules<ThreadGridRow>>(() => ({ "civic-row-focus": (p) => p.data?.ts === highlightId }), [highlightId]);

  const gridContext = useMemo(() => ({ openDetail }), [openDetail]);

  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<ThreadRowDept | "">("");
  const [pageChoice, setPageChoice] = useState<PageChoice>(25);
  const allChipRef = useRef<HTMLButtonElement>(null);

  const searched = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      [r.ts, r.from, r.text, r.dept, r.status]
        .filter(Boolean)
        .some((s) => {
          const str = String(s).toLowerCase();
          return str.includes(q) || str.replace(/_/g, " ").includes(q);
        }),
    );
  }, [rows, query]);

  const filtered = useMemo(() => (deptFilter ? searched.filter((r) => r.dept === deptFilter) : searched), [searched, deptFilter]);

  const effectivePageSize = pageChoice === "all" ? Math.max(filtered.length, 1) : pageChoice;

  useEffect(() => {
    if (!focusId || !gridReady) return;
    if (!rows.some((r) => r.ts === focusId)) {
      setFocusId(null);
      return;
    }
    if (!filtered.some((r) => r.ts === focusId)) {
      setQuery("");
      setDeptFilter("");
      return;
    }
    setHighlightId(focusId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightId(null), 4000);
    openDetail(focusId);
    setFocusId(null);
  }, [focusId, gridReady, rows, filtered, openDetail]);

  // Page to the flagged row and repaint it (rowClassRules only run when a row
  // is built, hence the redraw). `filtered` is a re-run trigger.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `filtered` re-lands the row when the row set changes
  useEffect(() => {
    const api = gridApiRef.current;
    if (!highlightId || !api) return;
    const raf = requestAnimationFrame(() => {
      const node = api.getRowNode(highlightId);
      if (!node || node.rowIndex === null) return;
      api.paginationGoToPage(Math.floor(node.rowIndex / effectivePageSize));
      api.ensureNodeVisible(node, "middle");
      api.redrawRows();
    });
    return () => cancelAnimationFrame(raf);
  }, [highlightId, filtered, effectivePageSize]);

  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of searched) counts[r.dept] = (counts[r.dept] ?? 0) + 1;
    return counts;
  }, [searched]);

  // Every column is read-only, so any cell (bar the pinned actions button,
  // which opens itself) opens the message.
  const onCellClicked = useCallback(
    (e: CellClickedEvent<ThreadGridRow>) => {
      if (e.column.getColId() === "actions") return;
      if (e.data) openDetail(e.data.ts);
    },
    [openDetail],
  );

  const columnDefs = useMemo<ColDef<ThreadGridRow>[]>(
    () => [
      {
        colId: "created",
        headerName: "Reported",
        field: "at",
        cellRenderer: TimeCell,
        initialSort: "asc",
        initialWidth: 150,
        minWidth: 130,
      },
      {
        colId: "issue",
        headerName: "Issue",
        valueGetter: (p: ValueGetterParams<ThreadGridRow>) => (p.data ? `${p.data.from} ${p.data.text}` : ""),
        cellRenderer: IssueCell,
        initialFlex: 2,
        minWidth: 280,
      },
      {
        colId: "team",
        headerName: "Team",
        valueGetter: (p: ValueGetterParams<ThreadGridRow>) => (p.data ? p.data.team_label : ""),
        cellRenderer: TeamCell,
        initialFlex: 1.1,
        minWidth: 150,
      },
      {
        colId: "priority",
        headerName: "Priority",
        field: "priority",
        cellRenderer: PriorityCell,
        comparator: (a, b) => (a ?? -1) - (b ?? -1),
        initialWidth: 150,
        minWidth: 140,
      },
      {
        colId: "status",
        headerName: "Status",
        field: "status",
        cellRenderer: StatusCell,
        filterValueGetter: (p: ValueGetterParams<ThreadGridRow>) => (p.data?.status ? titleize(p.data.status) : "—"),
        initialWidth: 160,
        minWidth: 140,
      },
      {
        colId: "actions",
        headerName: "",
        pinned: "right",
        width: 56,
        minWidth: 56,
        maxWidth: 64,
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
        suppressMovable: true,
        cellRenderer: ExpandCell,
        cellStyle: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<ThreadGridRow>>(() => ({ sortable: true, resizable: true, filter: true, minWidth: 80 }), []);

  const chipBase = "inline-flex items-center rounded-[var(--radius-md)] border px-2.5 py-1 text-xs font-medium transition-colors";
  const chipIdle = "border-hairline bg-overlay text-subtle hover:border-hairline-strong hover:text-foreground";
  const chipActive = "border-transparent bg-foreground text-background";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <div data-tour="grid-toolbar" className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 sm:px-4 lg:px-6">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search author, text, ts…"
            aria-label="Search thread messages"
            className="w-full rounded-[var(--radius-md)] border border-hairline bg-surface py-1.5 pl-9 pr-3 text-sm text-foreground shadow-[var(--shadow-card)] placeholder:text-faint focus:border-hairline-strong"
          />
        </div>

        <fieldset data-tour="grid-status" className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">Filter by message kind</legend>
          <button
            ref={allChipRef}
            type="button"
            onClick={() => setDeptFilter("")}
            aria-pressed={deptFilter === ""}
            className={cn(chipBase, deptFilter === "" ? chipActive : chipIdle)}
          >
            All
            <span className="ml-1 tabular-nums opacity-60">{searched.length}</span>
          </button>
          {DEPTS.filter((d) => (deptCounts[d] ?? 0) > 0 || deptFilter === d).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                const turningOff = deptFilter === d;
                setDeptFilter(turningOff ? "" : d);
                if (turningOff && (deptCounts[d] ?? 0) === 0) {
                  allChipRef.current?.focus();
                }
              }}
              aria-pressed={deptFilter === d}
              className={cn(chipBase, deptFilter === d ? chipActive : chipIdle)}
            >
              {DEPT_CHIP_LABEL[d]}
              <span className="ml-1 tabular-nums opacity-60">{deptCounts[d] ?? 0}</span>
            </button>
          ))}
        </fieldset>
      </div>

      <div ref={gridWrapRef} data-tour="grid-table" className="civic-grid relative min-h-0 flex-1">
        <AgGridReact<ThreadGridRow>
          theme={gridTheme}
          rowData={filtered}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={44}
          headerHeight={36}
          getRowId={(p) => p.data.ts}
          rowClassRules={rowClassRules}
          context={gridContext}
          onGridReady={(e: GridReadyEvent<ThreadGridRow>) => {
            gridApiRef.current = e.api;
            setGridReady(true);
            mountPagingSlot();
          }}
          onPaginationChanged={mountPagingSlot}
          onCellClicked={onCellClicked}
          pagination
          paginationPageSize={effectivePageSize}
          paginationPageSizeSelector={false}
          animateRows
          overlayNoRowsTemplate={"<span>No matching messages.</span>"}
        />
        {pagingSlot && createPortal(<PageSizeSelect value={pageChoice} onChange={setPageChoice} />, pagingSlot)}
      </div>

      <ThreadExplorer
        open={explorerOpen}
        onClose={closeExplorer}
        rows={filtered}
        model={model}
        graph={graph}
        events={events}
        channelId={channelId}
        selectedId={selectedId}
        onSelectId={selectId}
        onOpenFinding={onOpenFinding}
        detailDrawerOpen={detailDrawerOpen}
        onDetailDrawerChange={setDetailDrawerOpen}
      />
    </div>
  );
}
