#!/usr/bin/env node
/**
 * One command that checks the whole pipeline, not just the parts with tests.
 *
 * `npm run verify` proves the code compiles and the suites pass. It does not
 * prove the fixture documents still hash to what the cards cite, that the
 * generators still reproduce their output, or that the extractors and checkers
 * actually run on this machine — and every one of those failed here today
 * while verify stayed green: a checksum manifest unreadable because of line
 * endings, a generator that wrote CRLF, two test suites that reported zero
 * tests and passed, a record emitter that could not start.
 *
 * Each check prints one line and the script exits non-zero if any fail, so it
 * is usable before a demo and in CI.
 *
 *   npm run smoke
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const results = [];

function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail ?? "" });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
}

function python(args, { json = true } = {}) {
  const run = spawnSync(process.env.PYTHON ?? "python3", args, {
    cwd: ROOT,
    encoding: "utf8",
    input: json ? undefined : "",
  });
  if (run.error) throw new Error(`could not run python: ${run.error.message}`);
  return run;
}

check("fixture documents match SHA256SUMS", () => {
  const manifest = readFileSync(join(ROOT, "fixtures", "SHA256SUMS"), "utf8");
  if (manifest.includes("\r")) {
    throw new Error("SHA256SUMS has CRLF line endings; every path will carry a stray \\r");
  }
  const lines = manifest.trim().split("\n");
  for (const line of lines) {
    const [want, path] = line.split(/\s+/);
    const file = join(ROOT, path);
    if (!existsSync(file)) throw new Error(`${path} is listed but missing`);
    const got = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (got !== want) throw new Error(`${path} does not match its recorded hash`);
  }
  return `${lines.length} documents`;
});

check("workspace fixture regenerates byte-identically", () => {
  const path = join(ROOT, "fixtures", "workspace", "kestrel-workspace.json");
  const before = readFileSync(path);
  const run = python([join("fixtures", "generate_workspace.py")]);
  if (run.status !== 0) throw new Error(run.stderr.trim().split("\n").pop() ?? "generator failed");
  const after = readFileSync(path);
  if (!before.equals(after)) throw new Error("regenerated output differs from the committed file");
  return `${JSON.parse(after.toString()).length} messages`;
});

check("docx extractor reads the review document", () => {
  const run = python([join("extractors", "docx_text.py"), join("fixtures", "documents", "precharge-review-r2.docx")]);
  const out = JSON.parse(run.stdout);
  if (out.error) throw new Error(out.error);
  if (!out.paragraphs?.length) throw new Error("no paragraphs extracted");
  return `${out.paragraphs.length} paragraphs, sha ${out.sha256.slice(0, 12)}`;
});

check("xlsx extractor reads the parameter sheet", () => {
  const run = python([join("extractors", "xlsx_text.py"), join("fixtures", "documents", "ks4-sim-inputs-v2-1.xlsx")]);
  const out = JSON.parse(run.stdout);
  if (out.error) throw new Error(out.error);
  const mass = out.paragraphs?.find((p) => p.includes("mass_kg"));
  if (!mass?.includes("318")) throw new Error(`expected the corrected mass, got ${mass ?? "nothing"}`);
  return `${out.paragraphs.length} rows, sha ${out.sha256.slice(0, 12)}`;
});

for (const [checker, input, expect] of [
  [
    "rc",
    { R_ohm: 470, threshold: 0.999, timer_s: 2.5, capacitances: [{ label: "c", C_F: 0.00082 }] },
    (out) => {
      const t = out.outputs.per_capacitance.c.t_threshold_s;
      if (Math.abs(t - 2.6622) > 0.001) throw new Error(`820 uF should take 2.6622 s, got ${t}`);
      return `820 uF → ${t} s`;
    },
  ],
  [
    "route",
    { mass_kg: 318, Crr: 0.0048, CdA: 0.12, v_mps: 22, d_m: 220000, pack_kWh: 5.2, soc_start: 0.96, soc_end: 0.4 },
    (out) => {
      const c = out.outputs.cases.mass_318kg;
      if (c.feasible !== false) throw new Error("318 kg at 40 percent should not be feasible");
      return `318 kg → ${c.energy_kWh} kWh against ${c.budget_kWh} kWh`;
    },
  ],
]) {
  check(`${checker} checker computes its known value`, () => {
    const run = spawnSync(process.env.PYTHON ?? "python3", [join("checkers", `check_${checker}.py`)], {
      cwd: ROOT,
      encoding: "utf8",
      input: JSON.stringify({ checker, version: "1", inputs: input }),
    });
    if (run.error) throw new Error(run.error.message);
    const out = JSON.parse(run.stdout);
    if (out.error) throw new Error(out.error);
    return expect(out);
  });
}

check("npm run verify passes", () => {
  const run = spawnSync(process.env.npm_execpath ? process.execPath : "npm", process.env.npm_execpath ? [process.env.npm_execpath, "run", "verify"] : ["run", "verify"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: !process.env.npm_execpath,
  });
  if (run.status !== 0) {
    const errors = (run.stdout + run.stderr).split("\n").filter((l) => /error TS|fail [1-9]/.test(l));
    throw new Error(errors.slice(0, 3).join(" | ") || "verify exited non-zero");
  }
  // node --test prints "ℹ pass N" per workspace.
  const counts = [...run.stdout.matchAll(/pass (\d+)/g)].map((m) => Number(m[1]));
  const total = counts.reduce((a, b) => a + b, 0);
  return total ? `${total} tests` : "all suites";
});

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
}
console.log(`\n  ${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
