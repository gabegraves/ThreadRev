/**
 * Renderer for the ThreadRev desktop companion.
 *
 * Responsibilities, in order of how easy they are to get wrong:
 *
 *  1. Mouse pass-through. The window is a 420x560 transparent rectangle sitting
 *     over the corner of Slack. If it captured clicks everywhere, the corner of
 *     Slack would become dead. So the window ignores mouse events by default and
 *     we flip it live, based on whether the cursor is actually over the pet or
 *     the open panel. Electron keeps forwarding mousemove while click-through is
 *     on (`forward: true` in main.ts), which is what makes this hit test work.
 *  2. State. The pet's expression is the product's status display; it is driven
 *     by the findings feed, never set arbitrarily.
 *  3. The panel. Opens on click, closes on click, Escape, or the close button.
 */
import { SAMPLE, watchFindings, type Connection, type PetFinding } from "./findings.js";

declare global {
  interface Window {
    pet: {
      setInteractive(interactive: boolean): void;
      quit(): void;
    };
  }
}

type PetState = "idle" | "think" | "found" | "ok";

const petEl = document.getElementById("pet") as HTMLButtonElement;
const panelEl = document.getElementById("panel") as HTMLElement;
const bodyEl = document.getElementById("panel-body") as HTMLElement;
const statusEl = document.getElementById("panel-status") as HTMLElement;
const hintEl = document.getElementById("panel-hint") as HTMLElement;
const countEl = document.getElementById("pet-badge") as HTMLElement;
const closeEl = document.getElementById("panel-close") as HTMLButtonElement;
const quitEl = document.getElementById("panel-quit") as HTMLButtonElement;

let open = false;
let interactive = false;

/* ------------------------------------------------------------- hit test --- */

/**
 * True when (x, y) is over something the user can actually hit. Rect tests
 * rather than elementFromPoint: the pet is an SVG with transparent gaps between
 * its limbs, and making the user thread the needle between them feels broken.
 */
function overSolid(x: number, y: number): boolean {
  const inside = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  if (inside(petEl)) return true;
  return open && inside(panelEl);
}

function setInteractive(next: boolean): void {
  if (next === interactive) return;
  interactive = next;
  window.pet.setInteractive(next);
}

document.addEventListener("mousemove", (e) => {
  setInteractive(overSolid(e.clientX, e.clientY));
});

// The cursor can leave through the window edge without a final mousemove
// inside; without this the window would stay interactive and eat Slack's clicks.
document.addEventListener("mouseleave", () => setInteractive(false));

/* ---------------------------------------------------------------- state --- */

function setState(state: PetState): void {
  petEl.dataset.state = state;
  const label: Record<PetState, string> = {
    idle: "idle",
    think: "reviewing…",
    found: "findings",
    ok: "all clear",
  };
  statusEl.textContent = label[state];
  petEl.setAttribute(
    "aria-label",
    `ThreadRev companion, ${label[state]}. ${open ? "Close" : "Open"} findings.`,
  );
}

function setCount(n: number): void {
  countEl.hidden = n === 0;
  countEl.textContent = String(n);
}

/* ---------------------------------------------------------------- panel --- */

function setOpen(next: boolean): void {
  open = next;
  panelEl.dataset.open = String(next);
  panelEl.setAttribute("aria-hidden", String(!next));
  petEl.setAttribute("aria-expanded", String(next));
  if (next) closeEl.focus();
}

petEl.addEventListener("click", () => setOpen(!open));
closeEl.addEventListener("click", () => {
  setOpen(false);
  petEl.focus();
});
quitEl.addEventListener("click", () => window.pet.quit());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && open) {
    setOpen(false);
    petEl.focus();
  }
});

/* -------------------------------------------------------------- render --- */

function findingNode(f: PetFinding): HTMLElement {
  const el = document.createElement("article");
  el.className = "finding";
  el.dataset.status = f.status;

  const what = document.createElement("p");
  what.className = "finding__what";
  what.textContent = f.discrepancy;

  const why = document.createElement("p");
  why.className = "finding__why";
  why.textContent = f.status === "stale" ? f.resolution : f.why_it_matters;

  const meta = document.createElement("div");
  meta.className = "finding__meta";
  const tags = [
    f.status === "stale" ? "superseded" : `rev ${f.requirements_revision}`,
    ...f.sources.map((s) => (s.revision ? `${s.id} ${s.revision}` : s.id)),
  ];
  for (const t of tags) {
    const tag = document.createElement("span");
    tag.className = "finding__tag";
    tag.textContent = t;
    meta.append(tag);
  }

  el.append(what, why, meta);
  return el;
}

function renderEmpty(message: string): void {
  bodyEl.replaceChildren();
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = message;
  bodyEl.append(p);
}

function render(state: Connection): void {
  if (state.kind === "offline") {
    // Show the sample set so the pet is demonstrable without the reviewer, but
    // never let it read as real output.
    bodyEl.replaceChildren(...SAMPLE.map(findingNode));
    hintEl.textContent = "Sample data — reviewer not connected";
    setCount(0);
    setState("idle");
    return;
  }

  const live = state.findings.filter((f) => f.status === "live");
  hintEl.textContent = "Connected to reviewer";

  if (state.findings.length === 0) {
    renderEmpty("Nothing to flag.");
    setCount(0);
    setState("ok");
    return;
  }

  bodyEl.replaceChildren(...state.findings.map(findingNode));
  setCount(open ? 0 : live.length);
  setState(live.length > 0 ? "found" : "ok");
}

/* ----------------------------------------------------------------- boot --- */

setState("idle");
renderEmpty("Starting up…");
watchFindings(render);
