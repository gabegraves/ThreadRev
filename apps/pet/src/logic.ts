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
 * over a published region — Rev, plus the panel while the panel is open —
 * otherwise that corner of whatever is underneath goes dead. While dragging we
 * always capture, or the drag drops the moment the cursor outruns the sprite.
 *
 * The renderer publishes the regions and the main process evaluates this
 * against the OS cursor, so the decision never depends on forwarded mouse
 * events, which Electron can stop delivering on Windows (electron#33281).
 */
export function shouldCapture(
  regions: readonly Rect[],
  x: number,
  y: number,
  dragging = false,
): boolean {
  if (dragging) return true;
  return regions.some((r) => rectContains(r, x, y));
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

/* ------------------------------------------------------------ feed input --- */

/**
 * Everything below validates the reviewer's response.
 *
 * The endpoint is loopback, but it is still input this process does not
 * produce: a half-written file, an older reviewer, or a proxy returning an
 * error page all arrive here. Before this existed, a finding missing
 * `reproduced` threw inside the render loop and took the whole panel out — and
 * because the poll then kept re-rendering, it stayed out.
 *
 * The rule is coerce, never throw: anything unusable is dropped and the rest is
 * still shown. A reviewer that reports nine good findings and one malformed one
 * should show nine.
 */

export type FindingStatus = "live" | "stale";

export interface CleanSource {
  kind: "document" | "message";
  id: string;
  revision?: string;
  sha256?: string;
  locator?: string;
}

export interface CleanReproduced {
  label: string;
  printed?: number;
  computed: number;
  unit: string;
  matches?: boolean;
}

export interface CleanFinding {
  finding_id: string;
  status: FindingStatus;
  discrepancy: string;
  why_it_matters: string;
  resolution: string;
  requirements_revision: string;
  supersedes_reason?: string;
  sources: CleanSource[];
  reproduced: CleanReproduced[];
  inferred: string[];
  question?: { to: string; ask: string };
}

export type AgentPhase = "idle" | "reading" | "searching" | "checking";

export interface CleanFeed {
  findings: CleanFinding[];
  phase?: AgentPhase;
  revision?: string;
}

/** Guard against a hostile or broken producer flooding the panel. */
const MAX_FINDINGS = 100;
const MAX_ROWS = 60;
const MAX_SOURCES = 40;
/** Long enough for a real discrepancy, short enough that one cannot wedge the UI. */
const MAX_TEXT = 2000;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A trimmed string, or undefined. Rejects the empty string. */
function str(v: unknown, max = MAX_TEXT): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** A real number. Rejects NaN and Infinity, which format into nonsense. */
function fin(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function cleanSource(v: unknown): CleanSource | null {
  if (!isRecord(v)) return null;
  const id = str(v.id, 300);
  if (!id) return null;
  return {
    kind: v.kind === "message" ? "message" : "document",
    id,
    revision: str(v.revision, 40),
    sha256: str(v.sha256, 64),
    locator: str(v.locator, 200),
  };
}

function cleanReproduced(v: unknown): CleanReproduced | null {
  if (!isRecord(v)) return null;
  const label = str(v.label, 200);
  const computed = fin(v.computed);
  // A row with no computed value is the one thing this table cannot show: its
  // whole purpose is putting a recomputed number beside the printed one.
  if (!label || computed === undefined) return null;
  return {
    label,
    printed: fin(v.printed),
    computed,
    unit: str(v.unit, 24) ?? "",
    matches: typeof v.matches === "boolean" ? v.matches : undefined,
  };
}

function cleanQuestion(v: unknown): { to: string; ask: string } | undefined {
  if (!isRecord(v)) return undefined;
  const to = str(v.to, 120);
  const ask = str(v.ask, 600);
  return to && ask ? { to, ask } : undefined;
}

export function cleanFinding(v: unknown): CleanFinding | null {
  if (!isRecord(v)) return null;
  const finding_id = str(v.finding_id, 200);
  const discrepancy = str(v.discrepancy);
  // Without an id there is no way to track what has been seen, and without a
  // discrepancy the card has no headline. Everything else can be missing.
  if (!finding_id || !discrepancy) return null;

  return {
    finding_id,
    status: v.status === "stale" ? "stale" : "live",
    discrepancy,
    why_it_matters: str(v.why_it_matters) ?? "",
    resolution: str(v.resolution) ?? "",
    requirements_revision: str(v.requirements_revision, 40) ?? "—",
    supersedes_reason: str(v.supersedes_reason),
    sources: (Array.isArray(v.sources) ? v.sources : [])
      .slice(0, MAX_SOURCES)
      .map(cleanSource)
      .filter((s): s is CleanSource => s !== null),
    reproduced: (Array.isArray(v.reproduced) ? v.reproduced : [])
      .slice(0, MAX_ROWS)
      .map(cleanReproduced)
      .filter((r): r is CleanReproduced => r !== null),
    inferred: (Array.isArray(v.inferred) ? v.inferred : [])
      .slice(0, MAX_ROWS)
      .map((s) => str(s))
      .filter((s): s is string => s !== undefined),
    question: cleanQuestion(v.question),
  };
}

const PHASES: readonly string[] = ["idle", "reading", "searching", "checking"];

/** Coerce a whole response. Never throws; drops what it cannot use. */
export function cleanFeed(raw: unknown): CleanFeed {
  if (!isRecord(raw)) return { findings: [] };
  const findings = (Array.isArray(raw.findings) ? raw.findings : [])
    .slice(0, MAX_FINDINGS)
    .map(cleanFinding)
    .filter((f): f is CleanFinding => f !== null);

  // Two findings sharing an id would make "seen" tracking and the badge lie.
  const byId = new Map<string, CleanFinding>();
  for (const f of findings) if (!byId.has(f.finding_id)) byId.set(f.finding_id, f);

  return {
    findings: [...byId.values()],
    phase: typeof raw.phase === "string" && PHASES.includes(raw.phase)
      ? (raw.phase as AgentPhase)
      : undefined,
    revision: str(raw.revision, 40),
  };
}

/* ---------------------------------------------------------------- drag --- */

/**
 * Distance, in CSS px, the cursor may travel between press and release and
 * still count as a click rather than a drag.
 *
 * Without a threshold, `moved` flips on the first mousemove — and a mouse
 * emits moves from the hand tremor of pressing the button. The pet then read
 * almost every click as a zero-distance drag and never opened. Windows uses 4px
 * (SM_CXDRAG) for the same decision.
 */
export const DRAG_THRESHOLD_PX = 4;

export function isDrag(fromX: number, fromY: number, toX: number, toY: number): boolean {
  return Math.hypot(toX - fromX, toY - fromY) > DRAG_THRESHOLD_PX;
}

/* ---------------------------------------------------------------- radial --- */

export interface Bounds {
  width: number;
  height: number;
}

export interface Sweep {
  /** Angle of the first item, in degrees clockwise from due east. */
  from: number;
  /** Angle between adjacent items. */
  step: number;
}

/** Widest first: the menu opens as far as the space allows, then narrows. */
const SWEEP_CHOICES = [180, 160, 140, 120, 110, 100, 90] as const;

/** The arc's midpoint — up and to the left, where a corner-dwelling pet has room. */
const SWEEP_CENTRE = -135;

/**
 * Choose how wide the radial menu can open without any item leaving the window.
 *
 * The character holds still, so the menu has to fit around wherever it happens
 * to be. In the bottom-right corner there is only room for about 120 degrees;
 * drag it toward the middle and the same menu opens as a full semicircle.
 *
 * Adapting is what lets the character stay put. The alternative — and what this
 * replaced — was shifting it sixty pixels out of the corner every time the menu
 * opened, which is a lurch, and the whole point of a desktop companion is that
 * it does not yank your attention around.
 */
export function fitSweep(
  centre: { x: number; y: number },
  radius: number,
  count: number,
  bounds: Bounds,
  pad: number,
): Sweep {
  if (count < 2) return { from: SWEEP_CENTRE, step: 0 };

  const fits = (from: number, span: number): boolean => {
    const step = span / (count - 1);
    for (let i = 0; i < count; i++) {
      const a = ((from + step * i) * Math.PI) / 180;
      const x = centre.x + radius * Math.cos(a);
      const y = centre.y + radius * Math.sin(a);
      if (x - pad < 0 || x + pad > bounds.width) return false;
      if (y - pad < 0 || y + pad > bounds.height) return false;
    }
    return true;
  };

  for (const span of SWEEP_CHOICES) {
    const from = SWEEP_CENTRE - span / 2;
    if (fits(from, span)) return { from, step: span / (count - 1) };
  }

  // Nothing fit. Return the narrowest rather than nothing, so the menu is still
  // usable — clipped is recoverable, absent is not.
  const span = SWEEP_CHOICES[SWEEP_CHOICES.length - 1];
  return { from: SWEEP_CENTRE - span / 2, step: span / (count - 1) };
}
