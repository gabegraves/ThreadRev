"use client";

/* AG grid port of workspace-table.tsx, styled like thread-grid.tsx / the
   Findings grid (same theme params, `.civic-grid` wrapper, row height,
   portal-mounted page-size control in the pagination bar). Column filters
   (Author / Channel / Documents / Quantities) replace the popover facet row
   from workspace-filters.tsx — the query bar above (workspace-query-bar.tsx,
   now restyled to the same toolbar look) still drives which rows land here;
   these filters narrow within that result set.
   Channel cell uses channelIcon + "#channel" (Team-cell pattern). Flags cell
   carries the change / @Rev-mention pills, same pill classes as
   work-order-grid's StatusCell "needs review" badge. Trailing actions column
   opens the same detail panel/drawer a row click already does — added here
   only for the expand-affordance parity with work-order-grid. */

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
import { Check, ChevronDown, Maximize2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/civic-ui/lib/cn";
import { channelIcon } from "@/civic/lib/grid/team-icon";
import { useTheme } from "@/civic/lib/grid/use-theme";
import { fmtTime } from "@/components/review-console/graph-utils";
import { tsNum } from "@/lib/workspace-index";
import type { WorkspaceRow } from "./workspace-table";

ModuleRegistry.registerModules([AllCommunityModule]);

const REV_MENTION = /@rev\b/i;

// ── AG-Grid theme (copied from thread-grid.tsx) ─────────────────────────────
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

// ── cell renderers ──────────────────────────────────────────────────────────

function TimeCell({ data }: ICellRendererParams<WorkspaceRow>) {
  if (!data) return null;
  return (
    <span className="font-mono text-[12px] tabular-nums text-foreground" title={data.ts}>
      {fmtTime(data.ts)}
    </span>
  );
}

/** Channel — channelIcon(channel) + "#channel", the Team-cell pattern from
 *  work-order-grid / thread-grid. Author stays its own plain column. */
function ChannelCell({ data }: ICellRendererParams<WorkspaceRow>) {
  if (!data) return null;
  const Icon = channelIcon(data.channel_name);
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-subtle">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="truncate font-mono text-[12px] text-subtle">#{data.channel_name}</span>
    </span>
  );
}

function TextCell({ data }: ICellRendererParams<WorkspaceRow>) {
  if (!data) return null;
  return (
    <span title={data.text} className="block truncate text-[13px] leading-snug">
      {data.text}
    </span>
  );
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center rounded-[var(--radius-sm)] border border-hairline bg-overlay px-1.5 py-0.5 font-mono text-[12px] tabular-nums text-subtle">
      {children}
    </span>
  );
}

function DocumentsCell({ data }: ICellRendererParams<WorkspaceRow>) {
  if (!data) return null;
  if (data.documents.length === 0) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 py-1">
      {data.documents.map((d) => (
        <Chip key={d}>{d}</Chip>
      ))}
    </span>
  );
}

function QuantitiesCell({ data }: ICellRendererParams<WorkspaceRow>) {
  if (!data) return null;
  if (data.quantities.length === 0) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 py-1">
      {data.quantities.map((q, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the same value+unit can occur twice in one message
        <Chip key={`${q.value}${q.unit}${i}`} title={q.context}>
          {q.value} {q.unit}
        </Chip>
      ))}
    </span>
  );
}

/** Flags — change / @Rev-mention badges, same pill classes as
 *  work-order-grid's StatusCell "needs review" badge (border-hairline chip,
 *  bold 10px label, colored dot). */
function FlagsCell({ data }: ICellRendererParams<WorkspaceRow>) {
  if (!data) return null;
  const mentionsRev = REV_MENTION.test(data.text);
  if (!data.is_change && !mentionsRev) return <span className="text-faint">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {data.is_change && (
        <span
          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-hairline bg-overlay px-1.5 py-0.5 text-[10px] font-bold text-[var(--status-warning-fg)]"
          title="Matches the change-language pattern"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--color-warning)]" />
          Change
        </span>
      )}
      {mentionsRev && (
        <span
          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-hairline bg-overlay px-1.5 py-0.5 text-[10px] font-bold text-subtle"
          title="Message mentions @Rev"
        >
          @Rev
        </span>
      )}
    </span>
  );
}

function ExpandCell({ data, context }: ICellRendererParams<WorkspaceRow>) {
  if (!data) return null;
  const { onSelect } = context as { onSelect: (row: WorkspaceRow) => void };
  return (
    <button
      type="button"
      onClick={() => onSelect(data)}
      aria-label={`Open details for message ${data.ts}`}
      title="Open full details"
      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-transparent text-faint outline-none transition-colors hover:border-hairline hover:bg-overlay hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <Maximize2 className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

// ── Page-size control (copied from thread-grid.tsx) ─────────────────────────
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

export function WorkspaceGrid({
  rows,
  selectedTs,
  onSelect,
}: {
  rows: WorkspaceRow[];
  selectedTs: string | null;
  onSelect: (row: WorkspaceRow) => void;
}) {
  const { theme } = useTheme();
  const gridTheme = theme === "dark" ? gridThemeDark : gridThemeLight;

  const gridApiRef = useRef<GridApi<WorkspaceRow> | null>(null);
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

  const [pageChoice, setPageChoice] = useState<PageChoice>(25);
  const effectivePageSize = pageChoice === "all" ? Math.max(rows.length, 1) : pageChoice;

  const rowClassRules = useMemo<RowClassRules<WorkspaceRow>>(() => ({ "civic-row-focus": (p) => p.data?.ts === selectedTs }), [selectedTs]);

  const gridContext = useMemo(() => ({ onSelect }), [onSelect]);

  const onCellClicked = useCallback(
    (e: CellClickedEvent<WorkspaceRow>) => {
      if (e.column.getColId() === "actions") return;
      if (e.data) onSelect(e.data);
    },
    [onSelect],
  );

  const columnDefs = useMemo<ColDef<WorkspaceRow>[]>(
    () => [
      {
        colId: "time",
        headerName: "Time",
        field: "ts",
        cellRenderer: TimeCell,
        comparator: (a: string, b: string) => tsNum(a) - tsNum(b),
        initialSort: "asc",
        filter: false,
        initialWidth: 150,
        minWidth: 130,
      },
      {
        colId: "author",
        headerName: "Author",
        field: "user_name",
        filter: true,
        initialWidth: 160,
        minWidth: 120,
      },
      {
        colId: "channel",
        headerName: "Channel",
        field: "channel_name",
        cellRenderer: ChannelCell,
        filter: true,
        initialWidth: 150,
        minWidth: 120,
      },
      {
        colId: "text",
        headerName: "Text",
        valueGetter: (p: ValueGetterParams<WorkspaceRow>) => p.data?.text ?? "",
        cellRenderer: TextCell,
        wrapText: false,
        tooltipField: "text",
        filter: false,
        initialFlex: 2,
        minWidth: 260,
      },
      {
        colId: "documents",
        headerName: "Documents",
        valueGetter: (p: ValueGetterParams<WorkspaceRow>) => p.data?.documents ?? [],
        filterValueGetter: (p: ValueGetterParams<WorkspaceRow>) => p.data?.documents.join(" ") ?? "",
        cellRenderer: DocumentsCell,
        filter: true,
        initialWidth: 200,
        minWidth: 160,
      },
      {
        colId: "quantities",
        headerName: "Quantities",
        valueGetter: (p: ValueGetterParams<WorkspaceRow>) => p.data?.quantities ?? [],
        filterValueGetter: (p: ValueGetterParams<WorkspaceRow>) => p.data?.quantities.map((q) => `${q.value} ${q.unit}`).join(" ") ?? "",
        cellRenderer: QuantitiesCell,
        filter: true,
        initialWidth: 200,
        minWidth: 160,
      },
      {
        colId: "flags",
        headerName: "Flags",
        valueGetter: (p: ValueGetterParams<WorkspaceRow>) => (p.data?.is_change ? "change" : ""),
        cellRenderer: FlagsCell,
        filter: false,
        sortable: false,
        initialWidth: 130,
        minWidth: 110,
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

  const defaultColDef = useMemo<ColDef<WorkspaceRow>>(() => ({ sortable: true, resizable: true, filter: false, minWidth: 80 }), []);

  return (
    <div ref={gridWrapRef} data-tour="grid-table" className="civic-grid relative min-h-0 flex-1">
      <AgGridReact<WorkspaceRow>
        theme={gridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowHeight={44}
        headerHeight={36}
        getRowId={(p) => p.data.ts}
        rowClassRules={rowClassRules}
        context={gridContext}
        onGridReady={(e: GridReadyEvent<WorkspaceRow>) => {
          gridApiRef.current = e.api;
          mountPagingSlot();
        }}
        onPaginationChanged={mountPagingSlot}
        onCellClicked={onCellClicked}
        pagination
        paginationPageSize={effectivePageSize}
        paginationPageSizeSelector={false}
        animateRows
        overlayNoRowsTemplate={"<span>No indexed message matches every set field. The reviewer would have seen nothing.</span>"}
      />
      {pagingSlot && createPortal(<PageSizeSelect value={pageChoice} onChange={setPageChoice} />, pagingSlot)}
    </div>
  );
}
