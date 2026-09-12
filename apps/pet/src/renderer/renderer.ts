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
import { applyFilter, formatValue, isDrag, unreadCount, type Filter } from "../logic.js";

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
const liveRegion = $("live-region");
const liveCount = $("count-live");
const staleCount = $("count-stale");

let open = false;
let dragging = false;
let grab = { dx: 0, dy: 0 };
/** Where the press started, so a click is not mistaken for a zero-distance drag. */
let pressAt = { x: 0, y: 0 };
let moved = false;
let state: PetState = "idle";
let filter: Filter = "live";
let findings: PetFinding[] = [];
let isSample = true;
let settings: PetSettings = { alwaysOnTop: true, sleepAfterMin: 5, reducedMotion: false };
let lastActivity = Date.now();
/**
 * The OS-level preference. The tray toggle is an override on top of it, so a
 * user who set reduced motion system-wide gets it without discovering the menu.
 */
const osReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const reducedMotion = (): boolean => settings.reducedMotion || osReducedMotion.matches;
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
    // Only past the threshold; a press alone jiggles the cursor a pixel or two.
    if (!moved && isDrag(pressAt.x, pressAt.y, e.screenX, e.screenY)) moved = true;
    if (moved) window.pet.drag(grab.dx, grab.dy);
  }
  wake();
});

/* ----------------------------------------------------------------- drag --- */

hitEl.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  dragging = true;
  moved = false;
  pressAt = { x: e.screenX, y: e.screenY };
  grab = { dx: e.screenX - window.screenX, dy: e.screenY - window.screenY };
  petEl.dataset.dragging = "true";
  petEl.dataset.press = "true";
});

function endDrag(): void {
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
}

window.addEventListener("mouseup", endDrag);
// A release outside the window never reaches us as mouseup. Without this the
// drag would never end: the overlay would stay permanently interactive and eat
// every click in that corner of the screen.
window.addEventListener("blur", endDrag);
document.addEventListener("mouseleave", () => {
  if (dragging && moved) endDrag();
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
    if (state !== "asleep" && !reducedMotion()) {
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
  // offset* rather than getBoundingClientRect: the panel is mid-transform while
  // it opens, so its client rect is wherever the animation currently has it.
  // The thread has to target where the panel will come to rest.
  const x2 = panelEl.offsetLeft + panelEl.offsetWidth - 26;
  const y2 = panelEl.offsetTop + panelEl.offsetHeight;
  const r = petEl.getBoundingClientRect();
  const x1 = r.left + r.width * 0.5;
  const y1 = r.top + r.height * 0.18;
  const d = `M${x1} ${y1} C ${x1} ${y1 - 30}, ${x2} ${y2 + 34}, ${x2} ${y2}`;
  threadPath.setAttribute("d", d);
  const len = threadPath.getTotalLength();
  threadEl.style.setProperty("--len", String(Math.ceil(len)));
}

function setOpen(next: boolean): void {
  open = next;
  panelEl.dataset.open = String(next);
  // `inert` rather than aria-hidden: aria-hidden on a container whose children
  // are still tabbable is a contradiction, and lets Tab land on invisible
  // controls. inert removes them from focus and the accessibility tree at once.
  panelEl.toggleAttribute("inert", !next);
  hitEl.setAttribute("aria-expanded", String(next));
  petEl.dataset.open = String(next);

  publishRegions();
  if (next) {
    drawThread();
    threadEl.dataset.open = "true";
    // Opening is acknowledgement: clear the unread badge.
    for (const f of findings) seen.add(f.finding_id);
    renderBadge();
    // After the unroll, or focus lands on a control that is still clipped.
    window.setTimeout(() => $<HTMLButtonElement>("panel-close").focus(), 180);
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

/** Controls inside the panel, in DOM order, that can currently take focus. */
function focusables(): HTMLElement[] {
  const all = panelEl.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  );
  return [...all].filter((node) => node.offsetParent !== null);
}

document.addEventListener("keydown", (e) => {
  wake();
  if (!open) return;

  if (e.key === "Escape") {
    e.preventDefault();
    setOpen(false);
    return;
  }

  // Trap Tab inside the panel. The window is an overlay with nothing else in
  // it, so tabbing past the panel would otherwise strand focus on nothing.
  if (e.key === "Tab") {
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !panelEl.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

const tabEls = [...document.querySelectorAll<HTMLButtonElement>(".tab")];

/**
 * Roving tabindex: the tablist is one tab stop and the arrows move between the
 * tabs inside it. That is what role="tablist" promises, and it stops three
 * filters eating three Tab presses on the way to the findings.
 */
function selectTab(tab: HTMLButtonElement, moveFocus = false): void {
  const next = tab.dataset.filter;
  if (next !== "live" && next !== "stale" && next !== "all") return;
  filter = next;
  for (const t of tabEls) {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  }
  bodyEl.setAttribute("aria-labelledby", tab.id);
  if (moveFocus) tab.focus();
  renderList();
}

for (const [i, tab] of tabEls.entries()) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (e) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (delta !== 0) {
      e.preventDefault();
      selectTab(tabEls[(i + delta + tabEls.length) % tabEls.length], true);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectTab(tabEls[0], true);
    } else if (e.key === "End") {
      e.preventDefault();
      selectTab(tabEls[tabEls.length - 1], true);
    }
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
  table.append(el("caption", "sr-only", "Values the checker recomputed"));

  const thead = el("thead");
  const head = el("tr");
  for (const [label, cls] of [
    ["value", ""],
    ["printed", ""],
    ["computed", ""],
    ["reproduces", "repro__flag"],
  ] as const) {
    const th = el("th", cls || undefined, label);
    th.setAttribute("scope", "col");
    // First and last headers are for screen readers only: on screen the columns
    // are self-evident and the labels would crowd a 348px panel.
    if (label === "value" || label === "reproduces") th.classList.add("sr-only");
    head.append(th);
  }
  thead.append(head);
  table.append(thead);

  const tbody = el("tbody");

  for (const r of rows) {
    const tr = el("tr");
    if (r.matches !== undefined) tr.dataset.match = String(r.matches);
    const rowHead = el("th", undefined, r.label);
    rowHead.setAttribute("scope", "row");
    tr.append(rowHead);
    tr.append(el("td", undefined, r.printed === undefined ? "—" : formatValue(r.printed)));
    tr.append(el("td", undefined, `${formatValue(r.computed)}${r.unit ? ` ${r.unit}` : ""}`));
    const flag = el("td", "repro__flag");
    // The glyph is decorative; the word is what a screen reader should read.
    flag.textContent = r.matches === undefined ? "" : r.matches ? "✓" : "✗";
    flag.setAttribute("aria-hidden", "true");
    tr.append(flag);
    if (r.matches !== undefined) {
      tr.append(el("td", "sr-only", r.matches ? "reproduces" : "does not reproduce"));
    }
    tbody.append(tr);
  }
  table.append(tbody);
  return table;
}

function section(label: string, node: Node): HTMLElement {
  const wrap = el("div");
  wrap.append(el("span", "label", label), node);
  return wrap;
}

/**
 * Expand or collapse one card, keeping the visual state and the announced state
 * in step. They were set in two different places before, so the first card —
 * opened by default — reported itself collapsed until it had been clicked twice.
 */
function setCardExpanded(card: HTMLElement, expanded: boolean): void {
  card.dataset.expanded = String(expanded);
  card.querySelector(".finding__top")?.setAttribute("aria-expanded", String(expanded));
}

function findingNode(f: PetFinding, i: number): HTMLElement {
  const card = el("article", "finding");
  card.dataset.status = f.status;
  card.style.setProperty("--i", String(i));

  const top = el("button", "finding__top");
  top.type = "button";
  top.id = `fh-${f.finding_id}`;
  top.setAttribute("aria-expanded", "false");
  top.append(el("p", "finding__what", f.discrepancy));

  const caret = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  caret.setAttribute("viewBox", "0 0 16 16");
  caret.setAttribute("class", "finding__caret");
  const cp = document.createElementNS("http://www.w3.org/2000/svg", "path");
  cp.setAttribute("d", "M6 3l5 5-5 5");
  caret.append(cp);
  top.append(caret);

  const detail = el("div", "finding__detail");
  detail.id = `fd-${f.finding_id}`;
  detail.setAttribute("role", "region");
  detail.setAttribute("aria-labelledby", top.id);
  top.setAttribute("aria-controls", detail.id);
  const inner = el("div", "finding__inner");
  const pad = el("div", "finding__pad");

  pad.append(
    section(
      f.status === "stale" ? "Why it was superseded" : "Why it matters",
      el("p", "body-text", f.status === "stale" ? (f.supersedes_reason ?? f.resolution) : f.why_it_matters),
    ),
  );

  if (f.reproduced.length) {
    const scroll = el("div", "repro__scroll");
    scroll.append(reproTable(f.reproduced));
    pad.append(section("Reproduced by the checker", scroll));
  }

  if (f.sources.length) {
    const list = el("div");
    for (const s of f.sources) {
      const row = el("div", "source");
      const id = el("span", "source__id", s.id);
      // The id is ellipsised to fit; the full value has to stay reachable.
      id.title = s.id;
      row.append(id);
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

  top.addEventListener("click", () => setCardExpanded(card, card.dataset.expanded !== "true"));

  return card;
}

function renderEmpty(title: string, detail: string): void {
  const box = el("div", "empty");
  box.append(el("span", "empty__title", title));
  box.append(document.createTextNode(detail));
  bodyEl.replaceChildren(box);
}

let everConnected = false;
let lastAnnounced = "";

/**
 * Announce what the panel now shows.
 *
 * Deduplicated: the feed polls every 3s and re-announcing an unchanged count
 * would make the panel unusable with a screen reader running.
 */
function announce(message: string): void {
  if (message === lastAnnounced) return;
  lastAnnounced = message;
  liveRegion.textContent = message;
}

function renderList(): void {
  const shown = applyFilter(findings, filter);

  announce(
    shown.length === 0
      ? `No ${filter === "all" ? "" : filter} findings.`
      : `${shown.length} ${filter === "all" ? "" : filter} finding${shown.length === 1 ? "" : "s"}.`,
  );

  if (!shown.length) {
    if (filter === "stale") {
      renderEmpty(
        "No superseded cards",
        "Cards move here when a later revision invalidates them.",
      );
    } else if (!everConnected) {
      // Saying "nothing to flag" before the reviewer has ever answered would
      // claim a clean result that nobody has actually computed.
      renderEmpty("Not connected", "Waiting for the reviewer to answer.");
    } else {
      renderEmpty(
        "Nothing to flag",
        "Rev is watching the thread. It speaks up when a number stops reproducing.",
      );
    }
    return;
  }
  bodyEl.replaceChildren(...shown.map(findingNode));
  // First card opens by default; the rest stay collapsed.
  const first = bodyEl.firstElementChild as HTMLElement | null;
  if (first) setCardExpanded(first, true);
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
    everConnected = false;
    connEl.dataset.state = "offline";
    connLabel.textContent = "sample data — reviewer offline";
    revChip.textContent = "sample";
    petRev.textContent = "r?";
  } else {
    everConnected = true;
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

function applyMotionPreference(): void {
  document.body.dataset.reducedMotion = String(reducedMotion());
}

window.pet.onSettings((s) => {
  settings = s;
  applyMotionPreference();
});
osReducedMotion.addEventListener("change", applyMotionPreference);
applyMotionPreference();

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
