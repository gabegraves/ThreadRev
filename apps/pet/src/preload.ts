/**
 * Preload bridge. The renderer gets three verbs and nothing else — no Node, no
 * ipcRenderer handle. `setInteractive` is the one that matters: it is how a
 * transparent overlay stops swallowing clicks meant for Slack underneath.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("pet", {
  /** true while the cursor is over the pet or the open panel. */
  setInteractive(interactive: boolean): void {
    ipcRenderer.send("pet:set-interactive", interactive);
  },
  quit(): void {
    ipcRenderer.send("pet:quit");
  },
});
