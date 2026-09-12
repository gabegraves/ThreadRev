/**
 * ThreadRev desktop companion — main process.
 *
 * "Rev" is a frameless, transparent, always-on-top window that parks in a corner
 * of the work area and floats above the Slack desktop app. It is not injected
 * into Slack: the Slack desktop app exposes no extension surface, and Slack's own
 * app surfaces (App Home, modals, messages, Split View) all render inside Slack's
 * layout and cannot float.
 *
 * Three constraints shape everything here, all verified against Electron's
 * Windows behaviour rather than assumed:
 *
 *  1. Transparent windows cannot be resized reliably on Windows, so the window is
 *     a fixed box big enough to hold the expanded panel. The panel animates
 *     inside it; the window never changes size.
 *  2. Because of (1) most of the window is empty. It therefore starts
 *     click-through and the renderer hit-tests the cursor, flipping
 *     interactivity only over real pixels — otherwise the overlay would kill
 *     whatever sits under that corner.
 *  3. `transparent: true` needs an explicit `backgroundColor: "#00000000"` on
 *     Windows, and the window must be created hidden and shown with
 *     `showInactive()` so it never steals focus from the app underneath.
 */
import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  screen,
  shell,
} from "electron";
import path from "node:path";
import fs from "node:fs";

import { clampOrigin, shouldCapture, type Rect } from "./logic.js";

// Bundled to CJS, so __dirname is dist/.
const dirname = __dirname;

/** Fixed window box, in DIP. Wide enough for the panel, tall enough for it to grow. */
const WINDOW = { width: 412, height: 620 } as const;

/** How far the pet pokes past the work-area edge, so it reads as peeking in. */
const BLEED = 10;

interface Settings {
  /** Window origin, or null to use the default corner. */
  x: number | null;
  y: number | null;
  alwaysOnTop: boolean;
  /** Minutes of inactivity before Rev dozes off. 0 disables. */
  sleepAfterMin: number;
  reducedMotion: boolean;
}

const DEFAULTS: Settings = {
  x: null,
  y: null,
  alwaysOnTop: true,
  sleepAfterMin: 5,
  reducedMotion: false,
};

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let settings: Settings = { ...DEFAULTS };

/* ------------------------------------------------------------- settings --- */

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings(): void {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    settings = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    settings = { ...DEFAULTS };
  }
}

function saveSettings(): void {
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  } catch {
    // A companion app must not die because it could not write a preference.
  }
}

/* ------------------------------------------------------------ placement --- */

/** Default corner: bottom-right of the work area, bleeding past the edge. */
function defaultOrigin(): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - WINDOW.width + BLEED,
    y: workArea.y + workArea.height - WINDOW.height + BLEED,
  };
}

/** Clamp against the display nearest the point, not the primary one. */
function clamp(x: number, y: number): { x: number; y: number } {
  const { workArea } = screen.getDisplayNearestPoint({ x, y });
  return clampOrigin(x, y, WINDOW, workArea);
}

function place(target: BrowserWindow): void {
  const origin =
    settings.x !== null && settings.y !== null
      ? clamp(settings.x, settings.y)
      : defaultOrigin();
  target.setBounds({ ...origin, width: WINDOW.width, height: WINDOW.height });
}

/* ----------------------------------------------------------- tray glyph --- */

/**
 * Rev's aperture, drawn procedurally into a BGRA buffer.
 *
 * Generating it beats shipping a binary asset: no .ico to keep in sync with the
 * character, and the glyph can be re-rendered at whatever size Windows asks for.
 * `alert` swaps the ring to amber for the "findings waiting" state.
 */
function apertureIcon(size: number, alert: boolean): Electron.NativeImage {
  const buf = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const rOuter = size * 0.46;
  const rInner = size * 0.3;
  const rPupil = size * 0.13;

  // Amber matches the panel's "needs a decision" accent. This was blue, which
  // is the calm colour — the glyph could not signal the one thing it exists for.
  const ring: [number, number, number] = alert ? [240, 163, 60] : [232, 234, 237];
  const pupil: [number, number, number] = alert ? [240, 163, 60] : [154, 160, 168];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      let rgb: [number, number, number] | null = null;
      let a = 0;

      // Antialias each band by its distance to the band edge.
      const band = (lo: number, hi: number): number => {
        const edge = Math.min(d - lo, hi - d);
        return Math.max(0, Math.min(1, edge + 0.5));
      };

      if (d <= rPupil + 0.5) {
        rgb = pupil;
        a = Math.max(0, Math.min(1, rPupil - d + 0.5));
      } else if (d >= rInner - 0.5 && d <= rOuter + 0.5) {
        rgb = ring;
        a = band(rInner, rOuter);
      }

      if (rgb && a > 0) {
        const i = (y * size + x) * 4;
        // Electron wants premultiplied BGRA.
        buf[i] = Math.round(rgb[2] * a);
        buf[i + 1] = Math.round(rgb[1] * a);
        buf[i + 2] = Math.round(rgb[0] * a);
        buf[i + 3] = Math.round(255 * a);
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

/**
 * A tray image carrying both scale factors.
 *
 * Windows asks for 20px at 125% and 24px at 150%. Given only a 16px bitmap it
 * upscales, and a thin ring is exactly the shape that turns to mush. Supplying
 * a 2x representation lets it pick instead.
 */
function trayImage(alert: boolean): Electron.NativeImage {
  const img = apertureIcon(16, alert);
  img.addRepresentation({
    scaleFactor: 2,
    width: 32,
    height: 32,
    buffer: apertureIcon(32, alert).toBitmap(),
  });
  return img;
}

/** Open a URL in the real browser, ignoring anything that is not http(s). */
function openExternally(url: unknown): void {
  if (typeof url !== "string") return;
  try {
    if (/^https?:$/.test(new URL(url).protocol)) void shell.openExternal(url);
  } catch {
    // Not a usable URL; drop it.
  }
}

/* ---------------------------------------------------------------- menus --- */

function buildMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: win?.isVisible() ? "Hide Rev" : "Show Rev",
      click: () => toggleVisible(),
    },
    { type: "separator" },
    {
      label: "Always on top",
      type: "checkbox",
      checked: settings.alwaysOnTop,
      click: (item) => {
        settings.alwaysOnTop = item.checked;
        win?.setAlwaysOnTop(item.checked, "screen-saver");
        saveSettings();
      },
    },
    {
      label: "Reduce motion",
      type: "checkbox",
      checked: settings.reducedMotion,
      click: (item) => {
        settings.reducedMotion = item.checked;
        win?.webContents.send("pet:settings", settings);
        saveSettings();
      },
    },
    {
      label: "Sleep when idle",
      submenu: ([0, 2, 5, 15] as const).map((min) => ({
        label: min === 0 ? "Never" : `After ${min} min`,
        type: "radio" as const,
        checked: settings.sleepAfterMin === min,
        click: () => {
          settings.sleepAfterMin = min;
          win?.webContents.send("pet:settings", settings);
          saveSettings();
        },
      })),
    },
    { type: "separator" },
    {
      label: "Reset position",
      click: () => {
        settings.x = null;
        settings.y = null;
        if (win) place(win);
        saveSettings();
      },
    },
    { type: "separator" },
    { label: "Quit ThreadRev Pet", click: () => app.quit() },
  ]);
}

function toggleVisible(): void {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else win.showInactive();
  tray?.setContextMenu(buildMenu());
}

/* --------------------------------------------------------------- window --- */

function createWindow(): BrowserWindow {
  const target = new BrowserWindow({
    width: WINDOW.width,
    height: WINDOW.height,
    frame: false,
    transparent: true,
    // Required on Windows: without it the window paints an opaque backdrop.
    backgroundColor: "#00000000",
    show: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    type: process.platform === "darwin" ? "panel" : undefined,
    webPreferences: {
      preload: path.join(dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  target.setAlwaysOnTop(settings.alwaysOnTop, "screen-saver");
  target.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Start fully click-through; the renderer turns this off over real pixels.
  target.setIgnoreMouseEvents(true, { forward: true });

  place(target);
  void target.loadFile(path.join(dirname, "index.html"));

  // showInactive, never show: the companion must not take focus from Slack.
  target.once("ready-to-show", () => {
    target.showInactive();
    target.webContents.send("pet:settings", settings);
    // `--open` starts with the panel expanded. Useful for a demo that should
    // open already showing findings, and for capturing the panel in a test.
    if (process.argv.includes("--open")) target.webContents.send("pet:open");
    // `--state=<name>` pins Rev to one state. For verifying each look without
    // having to reproduce the agent phase that produces it.
    const pinned = process.argv.find((a) => a.startsWith("--state="));
    if (pinned) target.webContents.send("pet:force-state", pinned.slice("--state=".length));
  });

  // Always deny; open http(s) externally. Wrapped because `new URL` throws on a
  // malformed href, and throwing out of this handler would lose the deny.
  target.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: "deny" };
  });

  // Nothing may replace the overlay's own document.
  target.webContents.on("will-navigate", (e, url) => {
    if (url !== target.webContents.getURL()) {
      e.preventDefault();
      openExternally(url);
    }
  });

  return target;
}

/* ----------------------------------------------------------------- boot --- */

// Only one companion, or two Revs fight over the same corner.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => win?.showInactive());

  app.whenReady().then(() => {
    loadSettings();
    win = createWindow();

    tray = new Tray(trayImage(false));
    tray.setToolTip("ThreadRev — Rev");
    tray.setContextMenu(buildMenu());
    tray.on("click", () => toggleVisible());

    const reposition = () => {
      if (win && !win.isDestroyed()) place(win);
    };
    setInterval(pollCursor, 60);

    screen.on("display-metrics-changed", reposition);
    screen.on("display-added", reposition);
    screen.on("display-removed", reposition);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
    });
  });
}

/* ------------------------------------------------------------------ ipc --- */

/**
 * Hit regions, in window-relative DIP, published by the renderer whenever they
 * move. Main owns the click-through decision so it does not depend on forwarded
 * mouse events arriving — Electron's `forward: true` hook is documented to stop
 * delivering when certain other windows hold focus (electron#33281), and an
 * overlay that silently stops being clickable is the worst possible failure.
 */
let regions: Rect[] = [];

ipcMain.on("pet:regions", (_e, payload: unknown) => {
  regions = Array.isArray(payload) ? (payload as Rect[]) : [];
});

/**
 * Poll the OS cursor and flip click-through accordingly.
 *
 * 60ms is under the threshold where a user notices the boundary, and the work
 * is one cursor read plus a couple of rect tests, so it is far cheaper than the
 * system-wide low-level mouse hook it replaces.
 */
function pollCursor(): void {
  if (!win || win.isDestroyed()) return;
  if (!win.isVisible()) {
    // Reset, or re-showing restores whatever the flag happened to be.
    if (interactive) {
      interactive = false;
      win.setIgnoreMouseEvents(true, { forward: true });
    }
    return;
  }
  const b = win.getBounds();
  const c = screen.getCursorScreenPoint();
  const x = c.x - b.x;
  const y = c.y - b.y;
  // A drag with no movement for a beat is over, whatever the renderer said.
  // Trusting drag-end alone means one lost message leaves the overlay
  // permanently interactive, killing that corner of the screen.
  if (dragging && Date.now() - lastDragAt > 1200) dragging = false;
  const over = shouldCapture(regions, x, y, dragging);
  if (over === interactive) return;
  interactive = over;
  win.setIgnoreMouseEvents(!over, { forward: true });
}

let interactive = false;
let dragging = false;
let lastDragAt = 0;

/**
 * Drag. The renderer cannot move the window itself, and `-webkit-app-region:
 * drag` is unusable here: it would make the dragged element swallow clicks, and
 * the pet must stay clickable. So the renderer reports the grab offset and we
 * follow the OS cursor.
 */
ipcMain.on("pet:drag", (_e, payload: unknown) => {
  if (!win || win.isDestroyed()) return;
  dragging = true;
  lastDragAt = Date.now();
  const { dx, dy } = payload as { dx: number; dy: number };
  const cursor = screen.getCursorScreenPoint();
  const { x, y } = clamp(cursor.x - dx, cursor.y - dy);
  win.setBounds({ x, y, width: WINDOW.width, height: WINDOW.height });
});

ipcMain.on("pet:drag-end", () => {
  dragging = false;
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  settings.x = b.x;
  settings.y = b.y;
  saveSettings();
});

/** Rev's state drives the tray glyph, so attention is visible with the pet hidden. */
ipcMain.on("pet:state", (_e, state: unknown) => {
  if (!tray || tray.isDestroyed()) return;
  tray.setImage(trayImage(state === "found"));
  tray.setToolTip(`ThreadRev — ${String(state)}`);
});

ipcMain.on("pet:context-menu", () => {
  buildMenu().popup({ window: win ?? undefined });
});

ipcMain.on("pet:hide", () => {
  win?.hide();
  tray?.setContextMenu(buildMenu());
});

ipcMain.on("pet:quit", () => app.quit());

ipcMain.on("pet:open-external", (_e, url: unknown) => openExternally(url));

app.on("window-all-closed", () => app.quit());
