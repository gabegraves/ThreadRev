/**
 * ThreadRev desktop companion — main process.
 *
 * The pet is a frameless, transparent, always-on-top window parked in the
 * bottom-right of the work area. It floats above the Slack desktop app (or
 * anything else); it is not injected into Slack, because the Slack desktop app
 * exposes no extension surface.
 *
 * Two things make a transparent overlay behave like a pet rather than an
 * invisible wall over the corner of the screen:
 *
 *   1. The window is larger than the pet, so the panel has room to expand into
 *      it without a resize (resizing a transparent window mid-animation flickers
 *      on Windows).
 *   2. Because of (1) most of the window is empty, so it ignores mouse events by
 *      default and only captures them while the cursor is over real pixels. The
 *      renderer decides that and calls back over IPC.
 */
import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import path from "node:path";

// Bundled to CJS, so __dirname is the real one: dist/.
const dirname = __dirname;

/** Window box. Big enough to hold the expanded panel; mostly transparent. */
const WINDOW = { width: 420, height: 560 } as const;

/**
 * Gap from the work-area corner. Slightly negative so the pet is clipped by the
 * screen edge the way the reference designs are clipped by the app edge.
 */
const MARGIN = { right: -8, bottom: -12 } as const;

let win: BrowserWindow | null = null;

function position(target: BrowserWindow): void {
  const { workArea } = screen.getPrimaryDisplay();
  target.setBounds({
    x: workArea.x + workArea.width - WINDOW.width - MARGIN.right,
    y: workArea.y + workArea.height - WINDOW.height - MARGIN.bottom,
    width: WINDOW.width,
    height: WINDOW.height,
  });
}

function createWindow(): BrowserWindow {
  const target = new BrowserWindow({
    width: WINDOW.width,
    height: WINDOW.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    // Keep it out of the alt-tab/Mission Control story; it is furniture.
    type: process.platform === "darwin" ? "panel" : undefined,
    webPreferences: {
      preload: path.join(dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // "screen-saver" is the highest standard level, so the pet stays above the
  // Slack desktop window even when Slack is focused and maximized.
  target.setAlwaysOnTop(true, "screen-saver");
  target.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Start fully click-through. The renderer turns this off the moment the
  // cursor is over the pet or the panel, and back on when it leaves.
  target.setIgnoreMouseEvents(true, { forward: true });

  position(target);
  void target.loadFile(path.join(dirname, "index.html"));

  // Anything the panel links to belongs in the real browser, not in here.
  target.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  return target;
}

app.whenReady().then(() => {
  win = createWindow();

  // Follow the corner when the display layout changes (docking, resolution
  // change, taskbar auto-hide toggling the work area).
  const reposition = () => {
    if (win && !win.isDestroyed()) position(win);
  };
  screen.on("display-metrics-changed", reposition);
  screen.on("display-added", reposition);
  screen.on("display-removed", reposition);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
  });
});

/**
 * The renderer reports whether the cursor is currently over something solid.
 * `forward: true` keeps hover/scroll events flowing to the window underneath
 * while we are transparent, so Slack still feels normal behind the pet.
 */
ipcMain.on("pet:set-interactive", (_event, interactive: unknown) => {
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(!interactive, { forward: true });
});

ipcMain.on("pet:quit", () => {
  app.quit();
});

// The overlay is the whole app; closing it should exit rather than linger.
app.on("window-all-closed", () => {
  app.quit();
});
