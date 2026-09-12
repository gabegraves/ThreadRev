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
  /** true while the cursor is over the pet or the open panel. */
  setInteractive(interactive: boolean): void {
    ipcRenderer.send("pet:set-interactive", interactive);
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
  quit(): void {
    ipcRenderer.send("pet:quit");
  },
  openExternal(url: string): void {
    ipcRenderer.send("pet:open-external", url);
  },
  onSettings(handler: (settings: PetSettings) => void): void {
    ipcRenderer.on("pet:settings", (_e, settings: PetSettings) => handler(settings));
  },
  onOpen(handler: () => void): void {
    ipcRenderer.on("pet:open", () => handler());
  },
  onForceState(handler: (state: string) => void): void {
    ipcRenderer.on("pet:force-state", (_e, state: string) => handler(state));
  },
});
