/**
 * The parts of Rev that are pure, so they can be tested without a window.
 *
 * Everything here is shared between the main process (placement) and the
 * renderer (formatting, filtering, hit-testing). Keeping them separate from the
 * DOM is the only way the overlay's fiddly bits — clamping onto a display that
 * may not exist any more, deciding when the window is allowed to eat a click —
 * get checked by anything other than a screenshot.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Inclusive point-in-rect. */
export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/**
 * Whether the overlay should capture the mouse at this point.
 *
 * The window is a transparent box far larger than Rev. It must only take input
 * over Rev itself, or over the panel while the panel is open — otherwise that
 * corner of whatever is underneath goes dead. While dragging we always capture,
 * or the drag drops the moment the cursor outruns the sprite.
 */
export function shouldCapture(args: {
  x: number;
  y: number;
  pet: Rect;
  panel: Rect;
  open: boolean;
  dragging: boolean;
}): boolean {
  if (args.dragging) return true;
  if (rectContains(args.pet, args.x, args.y)) return true;
  return args.open && rectContains(args.panel, args.x, args.y);
}

/**
 * Keep `minVisible` pixels of the window on the given work area.
 *
 * Applied against the display nearest the requested point rather than the
 * primary one, so a position saved on a monitor that has since been unplugged
 * lands somewhere reachable instead of off-screen.
 */
export function clampOrigin(
  x: number,
  y: number,
  win: { width: number; height: number },
  workArea: Box,
  minVisible = 120,
): { x: number; y: number } {
  return {
    x: Math.round(
      Math.min(
        Math.max(x, workArea.x - win.width + minVisible),
        workArea.x + workArea.width - minVisible,
      ),
    ),
    y: Math.round(
      Math.min(
        Math.max(y, workArea.y - win.height + minVisible),
        workArea.y + workArea.height - minVisible,
      ),
    ),
  };
}

/**
 * Format a checker value for the reproduced-values table.
 *
 * The point of that table is that a human can see printed and computed side by
 * side and judge the gap, so integers must not become `2.0000`, and a small
 * fraction must not round away to `0.00` — the charge-fraction row is 0.99848
 * and the difference from 1 is the whole finding.
 */
export function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(Math.abs(v) < 1 ? 5 : 4);
}

export type Filter = "live" | "stale" | "all";

export function applyFilter<T extends { status: "live" | "stale" }>(
  items: readonly T[],
  filter: Filter,
): T[] {
  if (filter === "all") return [...items];
  return items.filter((f) => f.status === filter);
}

/**
 * How many live findings the user has not acknowledged.
 *
 * Stale cards never count: a superseded card is not news, and badging it would
 * train the user to ignore the badge.
 */
export function unreadCount<T extends { status: "live" | "stale"; finding_id: string }>(
  items: readonly T[],
  seen: ReadonlySet<string>,
): number {
  return items.filter((f) => f.status === "live" && !seen.has(f.finding_id)).length;
}
