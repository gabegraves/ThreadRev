/**
 * npm run replay:record -- <fixture-path> [--runs N] [--model]
 *
 * Replays one fixture through the harness and writes
 * evals/records/<mode>/<case>.<run>.json. Scripted mode only for now.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { loadFixture } from "./fixture-loader";
import { runReplay } from "./harness";
import { toRecord, type RunRecord } from "./record";
import { hasScript, scriptFor } from "./scripts";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const FIXTURES_DIR = join(REPO_ROOT, "fixtures");

function usage(message?: string): never {
  if (message) console.error(message);
  console.error("usage: npm run replay:record -- <fixture-path> [--runs N] [--model]");
  process.exit(2);
}

function parseArgs(argv: string[]) {
  let fixture: string | undefined;
  let runs = 1;
  let model = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--runs") {
      runs = Number(argv[++i]);
      if (!Number.isInteger(runs) || runs < 1) usage("--runs must be a positive integer");
    } else if (a.startsWith("--runs=")) {
      runs = Number(a.slice(7));
      if (!Number.isInteger(runs) || runs < 1) usage("--runs must be a positive integer");
    } else if (a === "--model") model = true;
    else if (a.startsWith("-")) usage(`unknown flag ${a}`);
    else if (fixture) usage("only one fixture path");
    else fixture = a;
  }
  if (!fixture) usage();
  return { fixture, runs, model };
}

/** "fixtures/slack/scenario-a.json" -> "scenario-a"; "fixtures/adversarial/x.json" -> "adversarial/x". */
export function caseNameFor(fixturePath: string): string {
  const abs = resolve(fixturePath);
  const name = basename(abs).replace(/\.json$/, "");
  const dir = relative(FIXTURES_DIR, dirname(abs));
  if (dir === "slack" || dir === "") return name;
  return `${dir.split(/[\\/]/).join("/")}/${name}`;
}

export async function recordFixture(fixturePath: string, run: number): Promise<RunRecord> {
  const abs = resolve(fixturePath);
  const caseName = caseNameFor(abs);
  const messages = loadFixture(basename(abs).replace(/\.json$/, ""), join(dirname(abs), ".."));
  const script = scriptFor(caseName, messages);
  const result = await runReplay({ messages, steps: script.steps, afterChecker: script.afterChecker });
  return toRecord({ caseName, run, mode: "scripted", model: null, result });
}

async function main() {
  const { fixture, runs, model } = parseArgs(process.argv.slice(2));
  if (model) {
    console.error(
      "--model is not implemented: model mode needs OPENAI_API_KEY and the BuiltInAgent wiring (G2). Blocked on OPENAI_API_KEY.",
    );
    process.exit(3);
  }
  const caseName = caseNameFor(fixture);
  if (!hasScript(caseName)) {
    console.error(`no scripted reviewer for ${caseName}; using the silent script (read_thread, no card)`);
  }
  for (let run = 1; run <= runs; run++) {
    const record = await recordFixture(fixture, run);
    const out = join(REPO_ROOT, "evals", "records", record.mode, `${record.case}.${run}.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
    console.log(
      `${relative(REPO_ROOT, out)}  cards=${record.posted_cards.length} replaced=${record.replaced_cards.length} checkers=${record.checker_runs.length} failure=${record.failure ?? "null"}`,
    );
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
