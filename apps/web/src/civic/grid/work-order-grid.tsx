"use client";

/* Ported from Civic src/components/city/work-order-grid.tsx (1560 lines).
   What changed and nothing else:
   - imports rewritten to the ported lib (src/civic/lib/grid) + civic-ui cn;
     useTheme is the MutationObserver shim; useCurrency / fetchCategoryCostStats
     / crew-types are gone with the cost + source columns they fed.
   - the enum tables (categories, statuses, departments) are re-keyed to the
     finding vocabulary (card kind, live/stale/refused, checker) with the class
     strings kept verbatim.
   - the explorer opens FindingDetail, so the grid takes graph + events.
   - focusReportId ↔ ?id= is owned by the wrapper (onSelectedChange). */

import {
  AllCommunityModule,
  type CellClickedEvent,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  ModuleRegistry,
  type RowClassRules,
  themeQuartz,
  type ValueFormatterParams,
  type ValueGetterParams,
} from "ag-grid-community";
import { AgGridReact, type CustomCellEditorProps } from "ag-grid-react";
import type { EvidenceEvent, EvidenceGraph } from "agent-core/shared";
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  HelpCircle,
  type LucideIcon,
  Maximize2,
  Search,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/civic-ui/lib/cn";
import { KIND_META, WorkOrderExplorer } from "@/civic/grid/work-order-explorer";
import type { GridReportRow } from "@/civic/lib/grid/dashboard-grid-data";
import { channelIcon } from "@/civic/lib/grid/team-icon";
import { TEAMS } from "@/civic/lib/grid/teams";
import { useTheme } from "@/civic/lib/grid/use-theme";

ModuleRegistry.registerModules([AllCommunityModule]);

// ── Canonical card-kind glyphs ──────────────────────────────────────────────
// Civic keyed these off CATEGORY_META's kebab icon; a finding has three kinds.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  discrepancy: CircleAlert,
  clean: CircleCheck,
  question: HelpCircle,
};

// Editable-column value lists (session-only edits — see WorkOrderGrid note).
const CATEGORIES = ["discrepancy", "clean", "question"];
const STATUSES = ["live", "stale", "refused"];

const titleize = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const categoryLabel = (c: string | null) =>
  c ? (KIND_META[c]?.label ?? titleize(c)) : "Unclassified";

const SEVERITY_LABELS: Record<number, string> = {
  1: "Minor",
  2: "Low",
  3: "Moderate",
  4: "High",
  5: "Critical",
};

// Severity 1→5 runs a green→red traffic-light ramp so the level reads at a
// glance, not just from the digit. Built by color-mixing the three AA-tuned
// `--status-*-fg` tokens (not the saturated `--color-*` — those have no dark
// override, so text on them fails contrast in dark mode): success → warning →
// danger, with mixed midpoints for levels 2 and 4. One hue drives all three of
// a chip's surfaces — colored digit, 14% tint fill, 42% ring — so the same
// value is used as text (AA-safe) and as low-opacity tint.
const SEVERITY_HUE: Record<number, string> = {
  1: "var(--status-success-fg)",
  2: "color-mix(in srgb, var(--status-success-fg) 55%, var(--status-warning-fg))",
  3: "var(--status-warning-fg)",
  4: "color-mix(in srgb, var(--status-warning-fg) 50%, var(--status-danger-fg))",
  5: "var(--status-danger-fg)",
};

function severityChipStyle(value: number): React.CSSProperties {
  const hue = SEVERITY_HUE[value] ?? SEVERITY_HUE[3];
  return {
    color: hue,
    backgroundColor: `color-mix(in srgb, ${hue} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${hue} 42%, transparent)`,
    borderWidth: 1,
    borderStyle: "solid",
  };
}

// Priority (reproduced-value count) → the same green→red ramp. More
// recomputed numbers = a better-grounded card, so the ramp runs green-up here.
const PRIORITY_DOMAIN = 5;
function priorityHue(score: number): string {
  if (score <= 0) return SEVERITY_HUE[5];
  if (score === 1) return SEVERITY_HUE[4];
  if (score === 2) return SEVERITY_HUE[3];
  if (score === 3) return SEVERITY_HUE[2];
  return SEVERITY_HUE[1];
}

// Status → semantic vocabulary. live is the success state; stale needs
// attention (warning); refused is the publish gate saying no (danger). Same
// mapping drives the dropdown dot, the StatusCell pill, and the toolbar filter
// chips so the vocabulary reads identically everywhere.
const STATUS_TEXT: Record<string, string> = {
  live: "text-[var(--status-success-fg)]",
  stale: "text-[var(--status-warning-fg)]",
  refused: "text-[var(--status-danger-fg)]",
};

// Solid dot per status — used by the dropdown menu options and StatusCell.
const STATUS_DOT: Record<string, string> = {
  live: "bg-[var(--color-success)]",
  stale: "bg-[var(--color-warning)]",
  refused: "bg-[var(--color-danger)]",
};

// Outline+tint chip for the toolbar status filter buttons — mirrors
// STATUS_TEXT/STATUS_DOT so the active filter reads the same vocabulary,
// via the color-mix idiom already used for EditPill's hover border.
const STATUS_CHIP_ACTIVE: Record<string, string> = {
  live: "border-[color-mix(in_srgb,var(--color-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--status-success-fg)]",
  stale:
    "border-[color-mix(in_srgb,var(--color-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] text-[var(--status-warning-fg)]",
  refused:
    "border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--status-danger-fg)]",
};

// ── AG-Grid theme ───────────────────────────────────────────────────────────
// AG Grid's theming API takes literal color strings (no CSS custom properties),
// so these are hardcoded to match globals.css's token values exactly rather
// than referencing var(--token) — accent is the ink token (was the Apple-blue
// #0a84ff brand primary), hover/selection tints are neutral (was light-blue
// tints). No zebra — the hover tint + accent bar (globals.css .civic-grid) is
// the row signal.
const gridThemeLight = themeQuartz.withParams({
  accentColor: "#18181b", // --accent (light)
  backgroundColor: "#ffffff", // --surface (light)
  headerBackgroundColor: "#ffffff", // --surface (light) — quiet borderless header
  headerTextColor: "#6f6f76", // --faint (light)
  headerFontWeight: 600,
  foregroundColor: "#141415", // --foreground (light)
  fontFamily: "inherit",
  fontSize: 13,
  cellHorizontalPadding: 12,
  rowHoverColor: "rgba(0, 0, 0, 0.04)", // --overlay (light)
  selectedRowBackgroundColor: "rgba(24, 24, 27, 0.07)", // --accent-soft (light)
  borderColor: "rgba(0, 0, 0, 0.08)", // --hairline (light)
  wrapperBorderRadius: "0px", // full-bleed — grid runs edge-to-edge
  wrapperBorder: false, // no outer frame; grid fills the content area
});
const gridThemeDark = themeQuartz.withParams({
  accentColor: "#f4f4f5", // --accent (dark)
  backgroundColor: "#101012", // --surface (dark)
  headerBackgroundColor: "#101012", // --surface (dark) — quiet borderless header
  headerTextColor: "#85858c", // --faint (dark)
  headerFontWeight: 600,
  foregroundColor: "#ffffff", // --foreground (dark)
  fontFamily: "inherit",
  fontSize: 13,
  cellHorizontalPadding: 12,
  rowHoverColor: "rgba(255, 255, 255, 0.04)", // --overlay (dark)
  selectedRowBackgroundColor: "rgba(255, 255, 255, 0.09)", // --accent-soft (dark)
  borderColor: "rgba(255, 255, 255, 0.09)", // --hairline (dark)
  wrapperBorderRadius: "0px", // full-bleed — grid runs edge-to-edge
  wrapperBorder: false, // no outer frame; grid fills the content area
});

// Neutral icon tile for category glyphs — category color stays off chrome
// here (only map data layers and chart series carry category hue).
const ICON_TILE = "text-subtle";

// Team icon tile — a soft alpha-tinted tile in the team's own color (the
// "filled" icon read; lucide ships outline-only glyphs, so the fill lives on
// the tile, not the icon color).
function iconTileStyle(color: string): React.CSSProperties {
  return { color };
}

// ── Custom dropdown editor ──────────────────────────────────────────────────
// Replaces agSelectCellEditor: the native <select> popup is OS-drawn chrome
// that can't be styled (and clashes hard with the dark theme). This renders a
// styled listbox in an AG Grid popup UNDER the cell (cellEditorPopup) with
// keyboard support: arrows move, Enter picks, Escape cancels.

interface SelectOption {
  value: string | number;
  label: string;
}
type EditorKind = "category" | "status" | "severity" | "plain";

function OptionGlyph({
  kind,
  value,
}: {
  kind: EditorKind;
  value: string | number;
}) {
  if (kind === "category") {
    const Icon = CATEGORY_ICON[value as string] ?? HelpCircle;
    return (
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          ICON_TILE,
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
    );
  }
  if (kind === "status") {
    return (
      <span
        role="img"
        aria-label={`status: ${String(value).replace(/_/g, " ")}`}
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          STATUS_DOT[value as string] ?? STATUS_DOT.live,
        )}
      />
    );
  }
  if (kind === "severity") {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={severityChipStyle(value as number)}
      >
        {value}
      </span>
    );
  }
  return null;
}

type SelectEditorProps = CustomCellEditorProps<
  GridReportRow,
  string | number
> & {
  options: SelectOption[];
  kind: EditorKind;
};

function SelectEditor(props: SelectEditorProps) {
  const { value, onValueChange, stopEditing, options, kind } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  // Option ids + aria-activedescendant: focus stays on the listbox container,
  // so without these, arrow-key navigation is silent for screen readers.
  const listId = `wo-select-${props.column.getColId()}`;

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  useEffect(() => {
    (
      listRef.current?.children[active] as HTMLElement | undefined
    )?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (v: string | number) => {
    onValueChange(v);
    stopEditing();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(options[active].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      stopEditing();
    }
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={props.colDef.headerName}
      aria-activedescendant={`${listId}-opt-${active}`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ width: Math.max(props.column.getActualWidth(), 210) }}
      className="max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-hairline-strong bg-surface p-1.5 shadow-[var(--shadow-pop)] outline-none"
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            id={`${listId}-opt-${i}`}
            type="button"
            role="option"
            aria-selected={selected}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(o.value)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] text-foreground",
              i === active && "bg-overlay",
              selected && "font-medium",
            )}
          >
            <OptionGlyph kind={kind} value={o.value} />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {selected && (
              <Check className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Static option lists (dept/crew are built per-render — see WorkOrderGrid —
// because live rows carry values outside any enum).
const CATEGORY_OPTIONS: SelectOption[] = CATEGORIES.map((c) => ({
  value: c,
  label: categoryLabel(c),
}));
const STATUS_OPTIONS: SelectOption[] = STATUSES.map((s) => ({
  value: s,
  label: titleize(s),
}));
const SEVERITY_OPTIONS: SelectOption[] = [1, 2, 3, 4, 5].map((n) => ({
  value: n,
  label: SEVERITY_LABELS[n],
}));

/** Enum values first (canonical order), then any extra values observed in the
 *  data, so the current cell value is always present in its own dropdown. */
function buildOptions(
  enums: readonly string[],
  seen: Iterable<string | null>,
  labelFor: (v: string) => string,
): SelectOption[] {
  const known = new Set<string>(enums);
  const extras: string[] = [];
  for (const v of seen) {
    if (v && !known.has(v)) {
      known.add(v);
      extras.push(v);
    }
  }
  extras.sort();
  return [...enums, ...extras].map((v) => ({ value: v, label: labelFor(v) }));
}

// ── cell renderers ──────────────────────────────────────────────────────────

/** The select-affordance container: bordered pill + chevron, so editable cells
 *  read as dropdowns instead of static text. */
function EditPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // Quiet ghost affordance: chrome only appears on hover, so the grid
        // reads as calm text until you reach for a cell (was an always-on
        // bordered+shadowed pill — too loud at table density).
        "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-transparent bg-transparent py-1 pl-2 pr-1.5 transition-colors hover:border-hairline-strong hover:bg-overlay",
        className,
      )}
    >
      {children}
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
    </span>
  );
}

function CategoryCell({ data }: ICellRendererParams<GridReportRow>) {
  if (!data) return null;
  const Icon = CATEGORY_ICON[data.category ?? ""] ?? HelpCircle;
  return (
    <EditPill className="h-8 pl-1.5">
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
          ICON_TILE,
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span
        className="shrink-0 truncate text-[13px] font-medium text-foreground"
        title={data.subcategory ?? undefined}
      >
        {categoryLabel(data.category)}
      </span>
      {data.subcategory && (
        <span
          className="min-w-0 truncate text-[12px] text-faint"
          title={data.subcategory}
        >
          {data.subcategory}
        </span>
      )}
    </EditPill>
  );
}

/** Owning team — the channel the finding was published to, in the palette
 *  entry the adapter chose for it. Read-only (no pill/chevron). */
function TeamCell({ data }: ICellRendererParams<GridReportRow>) {
  if (!data) return null;
  const team = TEAMS[data.team_key] ?? TEAMS.general_admin;
  const Icon = channelIcon(data.team_label);
  return (
    <span className="flex items-center gap-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
        style={iconTileStyle(team.color)}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="truncate text-[13px] text-subtle">
        {data.team_label}
      </span>
    </span>
  );
}

function SeverityCell({ value }: ICellRendererParams<GridReportRow, number>) {
  if (value == null) return <span className="text-faint">—</span>;
  return (
    <EditPill className="h-8">
      <span
        className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-semibold"
        style={severityChipStyle(value)}
      >
        {value}
      </span>
    </EditPill>
  );
}

/** Priority — reproduced-value count + proportional bar. */
function PriorityCell({ data }: ICellRendererParams<GridReportRow>) {
  if (!data) return null;
  if (data.priority_score == null) {
    return <span className="text-faint">—</span>;
  }
  const score = data.priority_score;
  const pct = Math.max(4, Math.min(100, (score / PRIORITY_DOMAIN) * 100));
  const hue = priorityHue(score);
  return (
    <span className="flex items-center gap-2">
      <span
        className="tabular-nums text-[13px] font-semibold"
        style={{ color: hue }}
      >
        {score}
      </span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-elevated">
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: hue }}
        />
      </span>
    </span>
  );
}

/** Status is editable — dropdown pill wrapping a solid status dot + tinted
 *  label, so the cell reads like a select control. */
function StatusCell({ data }: ICellRendererParams<GridReportRow>) {
  if (!data) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <EditPill className="h-8 pl-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            STATUS_DOT[data.status] ?? STATUS_DOT.live,
          )}
        />
        <span
          className={cn(
            "text-[13px] font-medium capitalize",
            STATUS_TEXT[data.status] ?? STATUS_TEXT.live,
          )}
        >
          {data.status.replace(/_/g, " ")}
        </span>
      </EditPill>
      {data.needs_manual_review && (
        <span
          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-hairline bg-overlay px-1.5 py-0.5 text-[10px] font-bold text-[var(--status-warning-fg)]"
          title="Card carries inferred (un-recomputed) claims"
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-[var(--color-warning)]"
          />
          Review
        </span>
      )}
    </span>
  );
}

// ── SLA column ──────────────────────────────────────────────────────────────
// Age since the bound revision. A stale card has been sitting on a superseded
// revision for N days (red, like Civic's "Overdue Nd"); a live card is simply
// live; a refused one never landed.

interface SlaState {
  /** Sort key: refused < stale (more negative = older) < live. null = n/a. */
  remaining: number | null;
  tier: "overdue" | "due_soon" | "on_track" | "na";
  label: string;
}

/** Slack ts ("1787062320.000100") → ms; document revisions ("r2") → NaN. */
function revisionMs(rev: string): number {
  const secs = Number(rev.split(".")[0]);
  return Number.isFinite(secs) && secs > 0 ? secs * 1000 : Number.NaN;
}

function computeSla(row: GridReportRow): SlaState {
  if (row.status === "refused") {
    return { remaining: Number.NEGATIVE_INFINITY, tier: "overdue", label: "Refused" };
  }
  if (row.status !== "stale") {
    return { remaining: 0, tier: "on_track", label: "Live" };
  }
  const ms = revisionMs(row.bound_revision);
  if (Number.isNaN(ms)) return { remaining: null, tier: "na", label: "—" };
  const ageH = Math.max(0, (Date.now() - ms) / 3_600_000);
  const disp = ageH >= 48 ? `${Math.round(ageH / 24)}d` : `${Math.round(ageH)}h`;
  return { remaining: -ageH, tier: "overdue", label: `Stale ${disp}` };
}

const SLA_TIER_STYLE: Record<SlaState["tier"], string> = {
  overdue: "text-[var(--status-danger-fg)]",
  due_soon: "text-[var(--status-warning-fg)]",
  on_track: "text-muted",
  na: "text-faint",
};
const SLA_TIER_DOT: Record<SlaState["tier"], string> = {
  overdue: "bg-[var(--color-danger)]",
  due_soon: "bg-[var(--color-warning)]",
  on_track: "bg-[var(--color-success)]",
  na: "bg-transparent",
};

function SlaCell({ data }: ICellRendererParams<GridReportRow>) {
  if (!data) return null;
  const sla = computeSla(data);
  if (sla.tier === "na") {
    return <span className="text-[13px] text-faint">—</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 shrink-0 rounded-full", SLA_TIER_DOT[sla.tier])}
      />
      <span className={cn("text-[13px] font-medium", SLA_TIER_STYLE[sla.tier])}>
        {sla.label}
      </span>
    </span>
  );
}

/** Dept + Crew share this: label pill with chevron; null → muted em-dash pill
 *  (still editable, so it keeps the affordance). Rendered raw (no titleize):
 *  checker names and people are not enum keys. */
function LabelPillCell({
  value,
}: ICellRendererParams<GridReportRow, string | null>) {
  return (
    <EditPill className="h-8">
      <span
        className={cn(
          "truncate text-[13px]",
          value ? "text-foreground" : "text-faint",
        )}
      >
        {value ?? "—"}
      </span>
    </EditPill>
  );
}

const dateFmt = (p: ValueFormatterParams<GridReportRow, string>) =>
  p.value
    ? new Date(p.value).toLocaleDateString("en-US", { timeZone: "America/New_York", 
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** Trailing expand affordance — opens the full-finding explorer focused on this
 *  row. Reads openDetail off the grid `context` so the pinned column def never
 *  has to close over React state and trigger a columnDefs rebuild. Editable
 *  cells keep single-click-to-edit; this button (and any read-only cell — see
 *  onCellClicked) is the open path. */
function ExpandCell({ data, context }: ICellRendererParams<GridReportRow>) {
  if (!data) return null;
  const { openDetail } = context as { openDetail: (id: string) => void };
  const label = categoryLabel(data.category);
  return (
    <button
      type="button"
      onClick={() => openDetail(data.report_id)}
      aria-label={`Open details for ${label}`}
      title="Open full details"
      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-transparent text-faint outline-none transition-colors hover:border-hairline hover:bg-overlay hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <Maximize2 className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

// ── Page-size control ────────────────────────────────────────────────────────
// Custom styled dropdown (not AG Grid's built-in number-only selector) so "All"
// is an option, and so the chrome matches the grid's other styled dropdowns
// instead of an OS-drawn <select>. "all" maps to the full filtered row count so
// pagination collapses to a single page.
type PageChoice = 25 | 50 | 100 | "all";
const PAGE_CHOICES: PageChoice[] = [25, 50, 100, "all"];
const pageChoiceLabel = (c: PageChoice) => (c === "all" ? "All" : String(c));

function PageSizeSelect({
  value,
  onChange,
}: {
  value: PageChoice;
  onChange: (c: PageChoice) => void;
}) {
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
        <span className="tabular-nums text-foreground">
          {pageChoiceLabel(value)}
        </span>
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
                {selected && (
                  <Check className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WorkOrderGrid({
  rows,
  graph,
  events,
  focusReportId = null,
  onSelectedChange,
}: {
  rows: GridReportRow[];
  graph: EvidenceGraph;
  events: EvidenceEvent[];
  /** `?id=<finding_id>` deep link — scroll to it, flag it, open its card. */
  focusReportId?: string | null;
  /** Fired when the explorer's selection changes or closes (null); the
   *  wrapper mirrors it into `?id=`. */
  onSelectedChange?: (id: string | null) => void;
}) {
  const { theme } = useTheme();
  const gridTheme = theme === "dark" ? gridThemeDark : gridThemeLight;

  const gridApiRef = useRef<GridApi<GridReportRow> | null>(null);

  // AG Grid owns the pagination panel DOM and gives no slot for extra controls.
  // To sit the page-size selector INLINE between the row summary ("1 to 25 of
  // N") and the page nav ("Page 1 of 6"), splice a host node into the panel and
  // portal the React control into it — the portal keeps React in control of the
  // node. `mountPagingSlot` is idempotent and re-run on pagination changes so
  // the host re-heals if AG Grid ever rebuilds the panel.
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const [pagingSlot, setPagingSlot] = useState<HTMLElement | null>(null);
  const mountPagingSlot = useCallback(() => {
    const panel =
      gridWrapRef.current?.querySelector<HTMLElement>(".ag-paging-panel");
    if (!panel) return;
    const pageNav = panel.querySelector<HTMLElement>(
      ".ag-paging-page-summary-panel",
    );
    let host = panel.querySelector<HTMLElement>(":scope > .civic-page-size-slot");
    if (!host) {
      host = document.createElement("div");
      host.className = "civic-page-size-slot";
    }
    // Place (or re-place) it immediately before the page nav.
    if (pageNav && host.nextElementSibling !== pageNav) {
      panel.insertBefore(host, pageNav);
    }
    setPagingSlot((prev) => (prev === host ? prev : host));
  }, []);

  // Full-finding explorer (list + detail overlay), opened from a row's expand
  // button or a click on any read-only cell. Selection is held here so the
  // overlay opens pre-focused on the clicked row; detailDrawerOpen is the
  // narrow branch (detail in a Drawer instead of the side pane).
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

  const gridContext = useMemo(() => ({ openDetail }), [openDetail]);

  // Editable cells mutate rows in place; hold them in local state (seeded from
  // the adapter rows) so in-grid edits survive the search/filter recompute.
  // Edits are SESSION-ONLY — nothing writes back to the evidence log, so a
  // refresh reverts them. See the "session-only" note in the toolbar.
  const [data, setData] = useState<GridReportRow[]>(rows);
  useEffect(() => setData(rows), [rows]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // Deep-link focus. `gridReady` exists because gridApiRef is a ref: without a
  // state flip the focus effect can run before onGridReady and silently no-op.
  const [gridReady, setGridReady] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(focusReportId ?? null);
  const [focusMissId, setFocusMissId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rowClassRules = useMemo<RowClassRules<GridReportRow>>(
    () => ({ "civic-row-focus": (p) => p.data?.report_id === highlightId }),
    [highlightId],
  );

  useEffect(() => {
    setFocusId(focusReportId ?? null);
    setFocusMissId(null);
  }, [focusReportId]);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    [],
  );
  // Page size: base 25, user-selectable 25/50/100/All. "all" resolves to the
  // current filtered row count so pagination collapses to one page.
  const [pageChoice, setPageChoice] = useState<PageChoice>(25);
  const allChipRef = useRef<HTMLButtonElement>(null);

  // Search first, then status — the chip counts read from the searched set so
  // they always describe what the current search can actually reach.
  const searched = useMemo(() => {
    if (!query) return data;
    const q = query.toLowerCase();
    // Match raw values AND their displayed form.
    return data.filter((r) =>
      [
        r.report_id,
        categoryLabel(r.category),
        r.subcategory,
        r.address,
        r.department,
        r.crew_type,
        r.team_label,
      ]
        .filter(Boolean)
        .some((s) => {
          const str = String(s).toLowerCase();
          return str.includes(q) || str.replace(/_/g, " ").includes(q);
        }),
    );
  }, [data, query]);

  const filtered = useMemo(
    () =>
      statusFilter
        ? searched.filter((r) => r.status === statusFilter)
        : searched,
    [searched, statusFilter],
  );

  // "All" ⇒ one page holding every filtered row (min 1 — AG Grid rejects 0).
  const effectivePageSize =
    pageChoice === "all" ? Math.max(filtered.length, 1) : pageChoice;

  // Land the `?id=` deep link: page to the row, scroll it into view, flag it
  // briefly, and open its card. Membership in the full row set is checked
  // FIRST, so an id this log simply doesn't have produces a notice instead of
  // clearing the operator's filters for nothing.
  useEffect(() => {
    const api = gridApiRef.current;
    if (!focusId || !gridReady || !api) return;
    if (!data.some((r) => r.report_id === focusId)) {
      setFocusMissId(focusId);
      setFocusId(null);
      return;
    }
    if (!filtered.some((r) => r.report_id === focusId)) {
      // Present but filtered out — widen back to everything; this effect
      // re-runs on the recomputed `filtered` and finishes the job.
      setQuery("");
      setStatusFilter("");
      return;
    }
    setHighlightId(focusId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightId(null), 4000);
    setSelectedId(focusId);
    setExplorerOpen(true);
    setFocusId(null);
  }, [focusId, gridReady, data, filtered]);

  // Page to the flagged row and paint it. Keyed on `filtered`/page size too,
  // so a later row-data or filter change re-lands it instead of leaving the
  // operator on page 1 with nothing flagged. AG Grid evaluates rowClassRules
  // only when it BUILDS a row, hence the explicit redraw.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `filtered` is a re-run trigger, not a read — the row set changing under a live highlight has to re-land it
  useEffect(() => {
    const api = gridApiRef.current;
    if (!highlightId || !api) return;
    // A frame's grace: AG Grid applies new rowData on its own schedule, and a
    // goToPage issued before that is clamped back to page 0.
    const raf = requestAnimationFrame(() => {
      const node = api.getRowNode(highlightId);
      // rowIndex is the DISPLAYED index (sort applied) — paging off the
      // `filtered` array index would land on whatever row sorted into that
      // slot instead.
      if (!node || node.rowIndex === null) return;
      api.paginationGoToPage(Math.floor(node.rowIndex / effectivePageSize));
      api.ensureNodeVisible(node, "middle");
      api.redrawRows();
    });
    return () => cancelAnimationFrame(raf);
  }, [highlightId, filtered, effectivePageSize]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of searched) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [searched]);

  // Dept/crew values are whatever the rows carry (checker names, people) —
  // fold them into the dropdowns so a cell's current value is always
  // selectable. Derived from the `rows` PROP, not `data` state: edits can only
  // pick values already in the options, so keying off `data` would rebuild
  // these (and via them columnDefs) on every edit — and AG Grid re-applies
  // defined sort/width colDef attrs on columnDefs changes, clobbering user
  // sort + resizes.
  const deptOptions = useMemo(
    () =>
      buildOptions(
        [],
        rows.map((r) => r.department),
        (v) => v,
      ),
    [rows],
  );
  const crewOptions = useMemo(
    () =>
      buildOptions(
        [],
        rows.map((r) => r.crew_type),
        (v) => v,
      ),
    [rows],
  );

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<GridReportRow>) => {
      const updated = e.data;
      setData((prev) =>
        prev.map((r) =>
          r.report_id === updated.report_id ? { ...updated } : r,
        ),
      );
    },
    [],
  );

  // Click-to-open on read-only cells. Editable cells (category/severity/status/
  // dept/crew) keep single-click-to-edit, and the pinned actions button opens
  // itself — so this fires only for the plain cells (Team, Priority, SLA,
  // Reported), making "click the row" open the full finding without fighting
  // the inline editors.
  const onCellClicked = useCallback(
    (e: CellClickedEvent<GridReportRow>) => {
      if (e.colDef.editable) return;
      if (e.column.getColId() === "actions") return;
      if (e.data) openDetail(e.data.report_id);
    },
    [openDetail],
  );

  const columnDefs = useMemo<ColDef<GridReportRow>[]>(
    () => [
      {
        colId: "created",
        headerName: "Reported",
        field: "created_at",
        valueFormatter: dateFmt,
        initialWidth: 150,
        minWidth: 130,
      },
      {
        colId: "category",
        headerName: "Issue",
        field: "category",
        cellRenderer: CategoryCell,
        editable: true,
        cellEditor: SelectEditor,
        cellEditorPopup: true,
        cellEditorPopupPosition: "under",
        cellEditorParams: { options: CATEGORY_OPTIONS, kind: "category" },
        // Filter on the displayed label, not the raw key.
        filterValueGetter: (p: ValueGetterParams<GridReportRow>) =>
          p.data ? categoryLabel(p.data.category) : "Unclassified",
        initialFlex: 1.4,
        minWidth: 220,
      },
      {
        colId: "team",
        headerName: "Team",
        // Sort/filter/search on the channel label.
        valueGetter: (p: ValueGetterParams<GridReportRow>) =>
          p.data ? p.data.team_label : "",
        cellRenderer: TeamCell,
        initialFlex: 1.1,
        minWidth: 170,
      },
      {
        colId: "severity",
        headerName: "Sev",
        field: "severity",
        cellRenderer: SeverityCell,
        editable: true,
        cellEditor: SelectEditor,
        cellEditorPopup: true,
        cellEditorPopupPosition: "under",
        cellEditorParams: { options: SEVERITY_OPTIONS, kind: "severity" },
        initialWidth: 104,
        minWidth: 96,
      },
      {
        colId: "priority",
        headerName: "Priority",
        field: "priority_score",
        cellRenderer: PriorityCell,
        // Nulls sort last on a desc sort. initialSort (not sort) so a
        // columnDefs rebuild never re-imposes it over the user's sort.
        comparator: (a, b) => (a ?? -1) - (b ?? -1),
        initialSort: "desc",
        initialWidth: 150,
        minWidth: 140,
      },
      {
        colId: "status",
        headerName: "Status",
        field: "status",
        cellRenderer: StatusCell,
        editable: true,
        cellEditor: SelectEditor,
        cellEditorPopup: true,
        cellEditorPopupPosition: "under",
        cellEditorParams: { options: STATUS_OPTIONS, kind: "status" },
        filterValueGetter: (p: ValueGetterParams<GridReportRow>) =>
          p.data ? titleize(p.data.status) : "",
        initialWidth: 180,
        minWidth: 150,
      },
      {
        colId: "sla",
        headerName: "SLA",
        // Sort/filter on the age key (refused/oldest-stale sort first on asc).
        // Not editable — it's a derived read-only signal.
        valueGetter: (p: ValueGetterParams<GridReportRow>) =>
          p.data ? computeSla(p.data).remaining : null,
        cellRenderer: SlaCell,
        comparator: (a, b) =>
          (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY),
        initialWidth: 130,
        minWidth: 110,
      },
      {
        colId: "department",
        headerName: "Dept",
        field: "department",
        cellRenderer: LabelPillCell,
        editable: true,
        cellEditor: SelectEditor,
        cellEditorPopup: true,
        cellEditorPopupPosition: "under",
        cellEditorParams: { options: deptOptions, kind: "plain" },
        initialFlex: 1,
        minWidth: 150,
      },
      {
        colId: "crew",
        headerName: "Crew",
        field: "crew_type",
        cellRenderer: LabelPillCell,
        editable: true,
        cellEditor: SelectEditor,
        cellEditorPopup: true,
        cellEditorPopupPosition: "under",
        cellEditorParams: { options: crewOptions, kind: "plain" },
        initialWidth: 150,
        minWidth: 130,
      },
      {
        // Always-reachable open affordance: pinned right so it survives
        // horizontal scroll, and locked (no sort/filter/resize/move/edit) so it
        // reads as chrome, not data.
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
    [deptOptions, crewOptions],
  );

  const defaultColDef = useMemo<ColDef<GridReportRow>>(
    () => ({ sortable: true, resizable: true, filter: true, minWidth: 80 }),
    [],
  );

  const chipBase =
    "inline-flex items-center rounded-[var(--radius-md)] border px-2.5 py-1 text-xs font-medium transition-colors";
  const chipIdle =
    "border-hairline bg-overlay text-subtle hover:border-hairline-strong hover:text-foreground";

  return (
    // `relative` anchors the finding explorer overlay: it renders as an
    // absolute child here (not a body portal), so it fills the content column
    // and leaves the app sidebar visible — see WorkOrderExplorer.
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      {/* Toolbar keeps horizontal padding so search + chips have breathing
          room; the grid below runs full-bleed to the viewport edges. */}
      <div
        data-tour="grid-toolbar"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 sm:px-4 lg:px-6"
      >
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issue, address, department…"
            aria-label="Search findings"
            className="w-full rounded-[var(--radius-md)] border border-hairline bg-surface py-1.5 pl-9 pr-3 text-sm text-foreground shadow-[var(--shadow-card)] placeholder:text-faint focus:border-hairline-strong"
          />
        </div>

        <fieldset
          data-tour="grid-status"
          className="flex flex-wrap items-center gap-1.5"
        >
          <legend className="sr-only">Filter by status</legend>
          <button
            ref={allChipRef}
            type="button"
            onClick={() => setStatusFilter("")}
            aria-pressed={statusFilter === ""}
            className={cn(
              chipBase,
              statusFilter === ""
                ? "border-transparent bg-foreground text-background"
                : chipIdle,
            )}
          >
            All
            <span className="ml-1 tabular-nums opacity-60">
              {searched.length}
            </span>
          </button>
          {STATUSES.filter(
            (s) => (statusCounts[s] ?? 0) > 0 || statusFilter === s,
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                const turningOff = statusFilter === s;
                setStatusFilter(turningOff ? "" : s);
                // A zero-count chip only stays mounted while it IS the filter;
                // toggling it off unmounts it, so park focus on "All" instead
                // of letting it fall to <body>.
                if (turningOff && (statusCounts[s] ?? 0) === 0) {
                  allChipRef.current?.focus();
                }
              }}
              aria-pressed={statusFilter === s}
              className={cn(
                chipBase,
                statusFilter === s ? STATUS_CHIP_ACTIVE[s] : chipIdle,
              )}
            >
              {titleize(s)}
              <span className="ml-1 tabular-nums opacity-60">
                {statusCounts[s] ?? 0}
              </span>
            </button>
          ))}
        </fieldset>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Always visible — the grid is just as editable on mobile, and a
              hidden warning turns unsaved edits into silent data loss. */}
          <span
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-hairline bg-overlay px-2.5 py-1 text-[11px] font-medium text-[var(--status-warning-fg)]"
            title="Issue, severity, status, department, and crew are editable — click a cell. Changes are not saved to the database."
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
            Edits not saved to database
          </span>
        </div>
      </div>

      {focusMissId && (
        // The deep link pointed at a finding this log doesn't hold — say it
        // quietly rather than doing nothing.
        <div
          role="status"
          data-testid="grid-focus-missing"
          className="mx-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-hairline bg-overlay px-3 py-2 text-xs text-subtle sm:mx-4 lg:mx-6"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-faint" />
          <span className="min-w-0 flex-1">
            Finding <span className="font-mono">{focusMissId}</span>{" "}
            isn&apos;t in this grid.
          </span>
          <button
            type="button"
            onClick={() => setFocusMissId(null)}
            className="shrink-0 underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        ref={gridWrapRef}
        data-tour="grid-table"
        className="civic-grid relative min-h-0 flex-1"
      >
        <AgGridReact<GridReportRow>
          theme={gridTheme}
          rowData={filtered}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={44}
          headerHeight={36}
          getRowId={(p) => p.data.report_id}
          rowClassRules={rowClassRules}
          context={gridContext}
          onGridReady={(e: GridReadyEvent<GridReportRow>) => {
            gridApiRef.current = e.api;
            setGridReady(true);
            mountPagingSlot();
          }}
          onPaginationChanged={mountPagingSlot}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          onCellValueChanged={onCellValueChanged}
          onCellClicked={onCellClicked}
          pagination
          paginationPageSize={effectivePageSize}
          // Our own PageSizeSelect (adds "All"); suppress AG Grid's built-in one.
          paginationPageSizeSelector={false}
          // Smooth row-reorder on sort/filter. Works because getRowId is stable
          // (AG Grid diffs rows by id and tweens their positions); default-true
          // in v35, set explicitly so the intent survives future upgrades.
          animateRows
          overlayNoRowsTemplate={"<span>No matching findings.</span>"}
        />
        {/* Rendered into the host spliced into AG Grid's pagination panel, so
            the selector sits inline between "1 to 25 of N" and "Page 1 of 6". */}
        {pagingSlot &&
          createPortal(
            <PageSizeSelect value={pageChoice} onChange={setPageChoice} />,
            pagingSlot,
          )}
      </div>

      <WorkOrderExplorer
        open={explorerOpen}
        onClose={closeExplorer}
        rows={filtered}
        graph={graph}
        events={events}
        selectedId={selectedId}
        onSelectId={selectId}
        detailDrawerOpen={detailDrawerOpen}
        onDetailDrawerChange={setDetailDrawerOpen}
      />
    </div>
  );
}
