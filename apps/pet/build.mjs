/**
 * Bundles the three entry points the overlay needs and copies the static files.
 *
 * main and preload are CJS on purpose: Electron's ESM support is fine on 33.x
 * but the CJS path avoids the `type: module` / `.mjs` juggling for a target that
 * gains nothing from ESM.
 */
import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, "dist");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, "src/main.ts")],
  outfile: path.join(out, "main.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
});

await esbuild.build({
  entryPoints: [path.join(root, "src/preload.ts")],
  outfile: path.join(out, "preload.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
});

await esbuild.build({
  entryPoints: [path.join(root, "src/renderer/renderer.ts")],
  outfile: path.join(out, "renderer.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "chrome120",
});

await cp(path.join(root, "src/renderer/index.html"), path.join(out, "index.html"));
await cp(path.join(root, "src/renderer/styles.css"), path.join(out, "styles.css"));

console.log("pet: built to dist/");
