/**
 * Preload bridge. The renderer gets a fixed verb list and no ipcRenderer handle.
 *
 * `setInteractive` is the load-bearing one: it is how a transparent overlay
 * stops swallowing clicks meant for the app underneath.
 */
import { contextBridge, ipcRenderer } from "electron";

export interface PetSettings {
  alwaysOnTop: boolean;
  sleepAfterMin: number;
  reducedMotion: boolean;
}

contextBridge.exposeInMainWorld("pet", {
  /** Publish the hit regions; main decides click-through from the OS cursor. */
  setRegions(regions: Array<{ left: number; top: number; right: number; bottom: number }>): void {
    ipcRenderer.send("pet:regions", regions);
  },
  /** Report the grab offset; main follows the OS cursor from there. */
  drag(dx: number, dy: number): void {
    ipcRenderer.send("pet:drag", { dx, dy });
  },
  dragEnd(): void {
    ipcRenderer.send("pet:drag-end");
  },
  /** Mirror Rev's state onto the tray glyph. */
  reportState(state: string): void {
    ipcRenderer.send("pet:state", state);
  },
  contextMenu(): void {
    ipcRenderer.send("pet:context-menu");
  },
  hide(): void {
    ipcRenderer.send("pet:hide");
  },
  /** Change a setting. Main validates, persists, and echoes the new state back. */
  setSetting(patch: Partial<PetSettings>): void {
    ipcRenderer.send("pet:set-setting", patch);
  },
  resetPosition(): void {
    ipcRenderer.send("pet:reset-position");
  },
  quit(): void {
    ipcRenderer.send("pet:quit");
  },
  openExternal(url: string): void {
    ipcRenderer.send("pet:open-external", url);
  },
  /*
   * One listener per channel, replaced rather than appended. Registering twice
   * used to stack handlers with no way to remove them, so a reloaded renderer
   * would open the panel once per past registration.
   */
  onCursor(handler: (point: { x: number; y: number }) => void): void {
    ipcRenderer.removeAllListeners("pet:cursor");
    ipcRenderer.on("pet:cursor", (_e, point: { x: number; y: number }) => handler(point));
  },
  onSettings(handler: (settings: PetSettings) => void): void {
    ipcRenderer.removeAllListeners("pet:settings");
    ipcRenderer.on("pet:settings", (_e, settings: PetSettings) => handler(settings));
  },
  onOpen(handler: () => void): void {
    ipcRenderer.removeAllListeners("pet:open");
    ipcRenderer.on("pet:open", () => handler());
  },
  onForceState(handler: (state: string) => void): void {
    ipcRenderer.removeAllListeners("pet:force-state");
    ipcRenderer.on("pet:force-state", (_e, state: string) => handler(state));
  },
});
