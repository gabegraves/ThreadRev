/**
 * Rev's renderer: hit-testing, the state machine, drag, and the panel.
 *
 * Ordered by how easy each is to get wrong:
 *
 *  1. Mouse pass-through. The window is a transparent box over a corner of the
 *     screen. If it captured input across that whole box, that corner of Slack
 *     would go dead. So the window starts click-through and we hit-test the
 *     cursor on every mousemove, enabling input only over Rev or the open panel.
 *     Electron keeps delivering mousemove while click-through is on because main
 *     passes `forward: true`; without that this never runs.
 *  2. State. The aperture is a status display driven by the feed and the agent's
 *     reported phase. It is never set for decoration.
 *  3. Drag. The renderer cannot move the window, so it reports the grab offset
 *     and main follows the OS cursor.
 */
import {
  SAMPLE,
  watchFindings,
  type Connection,
  type PetFinding,
  type Reproduced,
} from "./findings.js";
import { applyFilter, formatValue, unreadCount, type Filter } from "../logic.js";

interface PetSettings {
  alwaysOnTop: boolean;
  sleepAfterMin: number;
  reducedMotion: boolean;
}

declare global {
  interface Window {
    pet: {
      setRegions(regions: Array<{ left: number; top: number; right: number; bottom: number }>): void;
      drag(dx: number, dy: number): void;
      dragEnd(): void;
      reportState(state: string): void;
      contextMenu(): void;
      hide(): void;
      quit(): void;
      openExternal(url: string): void;
      onSettings(handler: (s: PetSettings) => void): void;
      onOpen(handler: () => void): void;
      onForceState(handler: (state: string) => void): void;
    };
  }
}

type PetState =
  | "idle"
  | "reading"
  | "searching"
  | "checking"
  | "found"
  | "clear"
  | "stale"
  | "asleep";

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const petEl = $("pet");
const hitEl = $<HTMLButtonElement>("pet-hit");
const panelEl = $("panel");
const bodyEl = $("panel-body");
const subEl = $("panel-sub");
const revChip = $("rev-chip");
const petRev = document.getElementById("pet-rev") as unknown as SVGTextElement;
const countEl = $("pet-count");
const connEl = $("conn");
const connLabel = $("conn-label");
const threadEl = $("thread");
const threadPath = document.getElementById("thread-path") as unknown as SVGPathElement;
const liveCount = $("count-live");
const staleCount = $("count-stale");

let open = false;
let dragging = false;
let grab = { dx: 0, dy: 0 };
let moved = false;
let state: PetState = "idle";
let filter: Filter = "live";
let findings: PetFinding[] = [];
let isSample = true;
let settings: PetSettings = { alwaysOnTop: true, sleepAfterMin: 5, reducedMotion: false };
let lastActivity = Date.now();
let seen = new Set<string>();
/** Set by --state=<name>; freezes the aperture for visual verification. */
let pinnedState: PetState | null = null;

/* ------------------------------------------------------------- hit test --- */

/**
 * Publish the regions that may take the mouse.
 *
 * Rect tests rather than elementFromPoint: Rev is an SVG with transparent gaps
 * between its parts, and making the user thread the needle between them would
 * feel broken. Main polls the OS cursor against these, so click-through keeps
 * working even when forwarded mouse events stop arriving.
 */
function publishRegions(): void {
  const r = (el: Element) => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  };
  window.pet.setRegions(open ? [r(petEl), r(panelEl)] : [r(petEl)]);
}

/* ----------------------------------------------------------------- gaze --- */

/** Pupil drifts toward the cursor. Small on purpose: attention, not googly eyes. */
function gaze(x: number, y: number): void {
  const r = petEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height * 0.52;
  const d = Math.hypot(x - cx, y - cy) || 1;
  const reach = Math.min(d, 260) / 260;
  petEl.style.setProperty("--gaze-x", `${((x - cx) / d) * 5 * reach}px`);
  petEl.style.setProperty("--gaze-y", `${((y - cy) / d) * 5 * reach}px`);
}

document.addEventListener("mousemove", (e) => {
  gaze(e.clientX, e.clientY);
  if (dragging) {
    moved = true;
    window.pet.drag(grab.dx, grab.dy);
  }
  wake();
});

/* ----------------------------------------------------------------- drag --- */

hitEl.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  dragging = true;
  moved = false;
  grab = { dx: e.screenX - window.screenX, dy: e.screenY - window.screenY };
  petEl.dataset.dragging = "true";
  petEl.dataset.press = "true";
});

window.addEventListener("mouseup", () => {
  if (!dragging) return;
  dragging = false;
  delete petEl.dataset.dragging;
  delete petEl.dataset.press;
  if (moved) {
    window.pet.dragEnd();
  } else {
    // A click, not a drag.
    pop();
    setOpen(!open);
  }
});

hitEl.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  window.pet.contextMenu();
});

/** The squash-and-snap on click. */
function pop(): void {
  petEl.dataset.pop = "true";
  window.setTimeout(() => delete petEl.dataset.pop, 470);
}

/* ---------------------------------------------------------------- state --- */

const SUBTITLE: Record<PetState, string> = {
  idle: "watching",
  reading: "reading the thread",
  searching: "searching the workspace",
  checking: "recomputing",
  found: "needs a decision",
  clear: "nothing to flag",
  stale: "superseded",
  asleep: "dozing",
};

function setState(next: PetState): void {
  if (pinnedState) next = pinnedState;
  if (next === state) return;
  state = next;
  petEl.dataset.state = next;
  subEl.textContent = SUBTITLE[next];
  hitEl.setAttribute("aria-label", `Rev, ${SUBTITLE[next]}. ${open ? "Close" : "Open"} findings.`);
  window.pet.reportState(next);
}

/** Blink on a randomised cadence. A creature that never blinks reads as dead. */
function scheduleBlink(): void {
  const wait = 2600 + Math.random() * 4200;
  window.setTimeout(() => {
    if (state !== "asleep" && !settings.reducedMotion) {
      petEl.dataset.blink = "true";
      window.setTimeout(() => delete petEl.dataset.blink, 110);
    }
    scheduleBlink();
  }, wait);
}
scheduleBlink();

function wake(): void {
  lastActivity = Date.now();
  if (state === "asleep") recomputeState();
}

/** Doze off after the configured idle period. */
window.setInterval(() => {
  if (!settings.sleepAfterMin || open) return;
  const idleMs = Date.now() - lastActivity;
  if (idleMs > settings.sleepAfterMin * 60_000 && state !== "found") setState("asleep");
}, 5000);

/* --------------------------------------------------------------- panel --- */

/**
 * Draw the thread from Rev's top edge up to the panel's bottom-right corner, as
 * a curve. Measured from real rects so it stays correct wherever the panel and
 * Rev end up.
 */
function drawThread(): void {
  const p = panelEl.getBoundingClientRect();
  const r = petEl.getBoundingClientRect();
  const x1 = r.left + r.width * 0.5;
  const y1 = r.top + r.height * 0.18;
  const x2 = p.right - 26;
  const y2 = p.bottom;
  const d = `M${x1} ${y1} C ${x1} ${y1 - 30}, ${x2} ${y2 + 34}, ${x2} ${y2}`;
  threadPath.setAttribute("d", d);
  const len = threadPath.getTotalLength();
  threadEl.style.setProperty("--len", String(Math.ceil(len)));
}

function setOpen(next: boolean): void {
  open = next;
  panelEl.dataset.open = String(next);
  panelEl.setAttribute("aria-hidden", String(!next));
  hitEl.setAttribute("aria-expanded", String(next));
  petEl.dataset.open = String(next);

  publishRegions();
  if (next) {
    drawThread();
    threadEl.dataset.open = "true";
    // Opening is acknowledgement: clear the unread badge.
    for (const f of findings) seen.add(f.finding_id);
    renderBadge();
    window.setTimeout(() => $<HTMLButtonElement>("panel-close").focus(), 60);
  } else {
    delete threadEl.dataset.open;
    hitEl.focus();
  }
  wake();
}

$("panel-close").addEventListener("click", () => setOpen(false));
$("btn-hide").addEventListener("click", () => {
  setOpen(false);
  window.pet.hide();
});

document.addEventListener("keydown", (e) => {
  wake();
  if (e.key === "Escape" && open) setOpen(false);
});

for (const tab of document.querySelectorAll<HTMLButtonElement>(".tab")) {
  tab.addEventListener("click", () => {
    filter = tab.dataset.filter as Filter;
    for (const t of document.querySelectorAll(".tab")) {
      t.setAttribute("aria-selected", String(t === tab));
    }
    renderList();
  });
}

/* -------------------------------------------------------------- render --- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function reproTable(rows: Reproduced[]): HTMLElement {
  const table = el("table", "repro");
  const head = el("tr");
  for (const [label, cls] of [
    ["", ""],
    ["printed", ""],
    ["computed", ""],
    ["", "repro__flag"],
  ] as const) {
    const th = el("th", cls || undefined, label);
    head.append(th);
  }
  table.append(head);

  for (const r of rows) {
    const tr = el("tr");
    if (r.matches !== undefined) tr.dataset.match = String(r.matches);
    tr.append(el("td", undefined, r.label));
    tr.append(el("td", undefined, r.printed === undefined ? "—" : formatValue(r.printed)));
    tr.append(el("td", undefined, `${formatValue(r.computed)}${r.unit ? ` ${r.unit}` : ""}`));
    const flag = el("td", "repro__flag");
    flag.textContent = r.matches === undefined ? "" : r.matches ? "✓" : "✗";
    tr.append(flag);
    table.append(tr);
  }
  return table;
}

function section(label: string, node: Node): HTMLElement {
  const wrap = el("div");
  wrap.append(el("span", "label", label), node);
  return wrap;
}

function findingNode(f: PetFinding, i: number): HTMLElement {
  const card = el("article", "finding");
  card.dataset.status = f.status;
  card.style.setProperty("--i", String(i));

  const top = el("button", "finding__top");
  top.type = "button";
  top.append(el("p", "finding__what", f.discrepancy));

  const caret = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  caret.setAttribute("viewBox", "0 0 16 16");
  caret.setAttribute("class", "finding__caret");
  const cp = document.createElementNS("http://www.w3.org/2000/svg", "path");
  cp.setAttribute("d", "M6 3l5 5-5 5");
  caret.append(cp);
  top.append(caret);

  const detail = el("div", "finding__detail");
  const inner = el("div", "finding__inner");
  const pad = el("div", "finding__pad");

  pad.append(
    section(
      f.status === "stale" ? "Why it was superseded" : "Why it matters",
      el("p", "body-text", f.status === "stale" ? (f.supersedes_reason ?? f.resolution) : f.why_it_matters),
    ),
  );

  if (f.reproduced.length) {
    pad.append(section("Reproduced by the checker", reproTable(f.reproduced)));
  }

  if (f.sources.length) {
    const list = el("div");
    for (const s of f.sources) {
      const row = el("div", "source");
      row.append(el("span", "source__id", s.id));
      const meta = [s.revision, s.locator, s.sha256?.slice(0, 8)].filter(Boolean).join(" · ");
      row.append(el("span", "source__meta", meta));
      list.append(row);
    }
    pad.append(section("Sources", list));
  }

  if (f.inferred?.length) {
    pad.append(section("Inferred, not recomputed", el("p", "body-text", f.inferred.join(" "))));
  }

  if (f.status !== "stale") {
    pad.append(section("What resolves it", el("p", "body-text", f.resolution)));
  }

  if (f.question) {
    const ask = el("div", "ask");
    ask.append(el("span", "ask__to", `${f.question.to}: `));
    ask.append(document.createTextNode(f.question.ask));
    pad.append(ask);
  }

  inner.append(pad);
  detail.append(inner);
  card.append(top, detail);

  top.addEventListener("click", () => {
    const expanded = card.dataset.expanded === "true";
    card.dataset.expanded = String(!expanded);
  });

  return card;
}

function renderEmpty(title: string, detail: string): void {
  const box = el("div", "empty");
  box.append(el("span", "empty__title", title));
  box.append(document.createTextNode(detail));
  bodyEl.replaceChildren(box);
}

function renderList(): void {
  const shown = applyFilter(findings, filter);

  if (!shown.length) {
    renderEmpty(
      filter === "stale" ? "No superseded cards" : "Nothing to flag",
      filter === "stale"
        ? "Cards move here when a later revision invalidates them."
        : "Rev is watching the thread. It speaks up when a number stops reproducing.",
    );
    return;
  }
  bodyEl.replaceChildren(...shown.map(findingNode));
  // First card opens by default; the rest stay collapsed.
  const first = bodyEl.firstElementChild as HTMLElement | null;
  if (first) first.dataset.expanded = "true";
}

function renderBadge(): void {
  const unread = unreadCount(findings, seen);
  countEl.hidden = unread === 0;
  countEl.textContent = String(unread);
}

function recomputeState(): void {
  const live = findings.filter((f) => f.status === "live").length;
  if (live > 0) setState("found");
  else if (findings.length > 0) setState("clear");
  else setState("idle");
}

function render(conn: Connection): void {
  const wasSample = isSample;
  isSample = conn.kind === "offline";

  if (conn.kind === "offline") {
    findings = SAMPLE;
    connEl.dataset.state = "offline";
    connLabel.textContent = "sample data — reviewer offline";
    revChip.textContent = "sample";
    petRev.textContent = "r?";
  } else {
    findings = conn.feed.findings;
    connEl.dataset.state = "connected";
    connLabel.textContent = "connected to reviewer";
    const rev = conn.feed.revision ?? findings[0]?.requirements_revision ?? "—";
    revChip.textContent = rev;
    petRev.textContent = rev.length <= 3 ? rev : rev.slice(0, 3);
  }

  liveCount.textContent = String(findings.filter((f) => f.status === "live").length);
  staleCount.textContent = String(findings.filter((f) => f.status === "stale").length);
  const liveTab = document.querySelector<HTMLElement>('.tab[data-filter="live"]');
  if (liveTab) liveTab.dataset.tone = findings.some((f) => f.status === "live") ? "alert" : "";

  // A pushed phase wins: it reflects what the reviewer is doing right now.
  const phase = conn.kind === "connected" ? conn.feed.phase : undefined;
  if (phase && phase !== "idle") setState(phase);
  else recomputeState();

  if (isSample) seen = new Set(findings.map((f) => f.finding_id));
  renderBadge();
  if (wasSample !== isSample || !bodyEl.childElementCount) renderList();
  else renderList();
  if (open) drawThread();
}

/* ----------------------------------------------------------------- boot --- */

window.pet.onSettings((s) => {
  settings = s;
  document.body.dataset.reducedMotion = String(s.reducedMotion);
});

publishRegions();
// Rev bleeds past the corner and shifts on hover, so republish as it settles.
window.setInterval(publishRegions, 500);

window.pet.onOpen(() => setOpen(true));
window.pet.onForceState((s) => {
  pinnedState = s as PetState;
  state = "idle";
  setState(pinnedState);
});

setState("idle");
renderEmpty("Starting up", "Looking for the reviewer…");
watchFindings(render);
window.addEventListener("resize", () => {
  if (open) drawThread();
});
