#!/usr/bin/env node
/**
 * Launcher for the run-record CLI.
 *
 * The npm script used to be `TSX_TSCONFIG_PATH=… COPILOTKIT_TELEMETRY_DISABLED=…
 * node --import tsx …`, which is POSIX shell syntax. cmd.exe reads the first
 * assignment as a command name, so on Windows the eval lane could not emit a
 * single run record:
 *
 *   'TSX_TSCONFIG_PATH' is not recognized as an internal or external command
 *
 * The usual fix — setting the variable from a `--import` module — does not work
 * here: tsx reads TSX_TSCONFIG_PATH as it loads, and `--import tsx` has already
 * run by then. So set the environment in a parent process and spawn node with
 * it, which behaves the same everywhere and needs no new dependency.
 */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

const result = spawnSync(
  process.execPath,
  ["--env-file-if-exists=.env", "--import", "tsx", join(here, "src", "replay", "record-cli.ts"), ...process.argv.slice(2)],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: join(here, "tsconfig.json"),
      COPILOTKIT_TELEMETRY_DISABLED: "true",
    },
  },
);

if (result.error) {
  console.error(`  Could not start the record CLI: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
