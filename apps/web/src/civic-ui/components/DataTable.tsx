"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/* ==================================================================
   Dependency-free findings/audit grid.

   HONEST NOTE: this is the one component in the kit that is ASSEMBLED
   rather than lifted. Civic's real grid (src/components/city/
   work-order-grid.tsx, 1560 lines) is AG Grid and is welded to the app
   — see components/ag-grid-theme.ts if you want that path instead.
   Civic's only plain <table> (admin/webhooks-table.tsx) is raw zinc
   classes, not the token vocabulary, so it was rejected.

   So the chrome here is the Civic recipe transcribed from the pieces
   that ARE canonical: the `.wo-grid` header rule (11px / 600 /
   uppercase / 0.07em), rowHeight 44 + headerHeight 36 from the
   AgGridReact props, the `inset 2px 0 0 var(--color-primary)` hover
   bar, hairline dividers, and the Card surface. Nothing here invents a
   new visual value.
   ================================================================== */

export interface Column<Row> {
  /** Stable key; also the React key for the cell. */
  key: string;
  header: string;
  /** Cell renderer. Return a string for plain text, or any node. */
  cell: (row: Row) => ReactNode;
  /** Right-align numerics / hashes. */
  align?: "left" | "right";
  /** Inline width, e.g. "180px" or "22ch". */
  width?: string;
  /** Monospace the cell (sha256, revisions, ids). */
  mono?: boolean;
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  /** Row id painted with the deep-link landing flag. */
  focusedId?: string | null;
  /** Shown instead of the body when `rows` is empty. */
  emptyMessage?: string;
  /** Renders shimmer placeholder rows instead of data. */
  loading?: boolean;
  loadingRows?: number;
  className?: string;
}

export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  onRowClick,
  focusedId = null,
  emptyMessage = "No matching rows.",
  loading = false,
  loadingRows = 8,
  className,
}: DataTableProps<Row>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {/* Horizontal scroll lives on this wrapper, never on the page body. */}
      <div className="w-full overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-max border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-hairline">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "h-9 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: loadingRows }, (_, i) => (
                  <tr
                    // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
                    key={i}
                    className="border-b border-hairline last:border-0"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="h-11 px-3">
                        <span className="skeleton block h-3 w-full rounded-[var(--radius-sm)]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const id = getRowId(row);
                  const focused = focusedId === id;
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      aria-current={focused ? "true" : undefined}
                      className={cn(
                        "border-b border-hairline transition-[background-color,box-shadow] duration-[120ms] ease-linear last:border-0",
                        onRowClick && "cursor-pointer",
                        focused
                          ? "bg-accent-soft shadow-[inset_4px_0_0_var(--color-primary)]"
                          : "hover:bg-overlay hover:shadow-[inset_2px_0_0_var(--color-primary)]",
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "h-11 whitespace-nowrap px-3 align-middle text-foreground",
                            col.align === "right" && "text-right",
                            col.mono && "font-mono text-[12px] tabular-nums",
                          )}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {!loading && rows.length === 0 && (
        <div className="flex min-h-[120px] items-center justify-center">
          <p className="text-[13px] text-faint">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
