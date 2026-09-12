/**
 * The one place Node calls Python. Spawns `python3 checkers/check_<name>.py`,
 * writes the request to stdin, parses stdout with the `checkerResponse` schema.
 *
 * A malformed request still resolves: the checker exits 1 and writes a
 * response with `error` set and empty `outputs`. Callers must check `error`
 * before trusting `outputs`. Only a non-JSON stdout or a spawn failure rejects.
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  checkerRequest,
  checkerResponse,
  type CheckerRequest,
  type CheckerResponse,
} from "agent-core";

export const CHECKERS_DIR = join(import.meta.dirname, "../../../../checkers");

export interface RunCheckerOptions {
  /** Directory holding check_<name>.py. Defaults to the repo's checkers/. */
  checkersDir?: string;
  /** Interpreter. Defaults to `python3`. */
  python?: string;
  timeoutMs?: number;
}

/**
 * The environment a checker runs in.
 *
 * A checker is untrusted-adjacent by design: it exists so the model cannot put
 * a number on a card that nothing recomputed, and a child process that inherits
 * this one's environment inherits OPENAI_API_KEY, INTELLIGENCE_API_KEY and
 * everything else alongside it. Nothing in checkers/ reads an env var, so
 * handing them one is pure downside.
 *
 * PATH stays so the interpreter resolves; SystemRoot stays because Python on
 * Windows will not start without it. This is environment hygiene, not a
 * sandbox — the child still has the filesystem and the network, so say
 * "out-of-process checker the model cannot edit", never "sandboxed".
 */
export function checkerEnv(from: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const keep = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "COMSPEC", "TEMP", "TMP", "LANG", "PYTHONIOENCODING"];
  const env: NodeJS.ProcessEnv = { PYTHONIOENCODING: "utf-8" };
  for (const k of keep) if (from[k] !== undefined) env[k] = from[k];
  return env;
}

export function checkerScript(name: string, dir = CHECKERS_DIR): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`invalid checker name: ${JSON.stringify(name)}`);
  }
  return join(dir, `check_${name}.py`);
}

export function runChecker(
  req: CheckerRequest,
  options: RunCheckerOptions = {},
): Promise<CheckerResponse> {
  const request = checkerRequest.parse(req);
  const script = checkerScript(request.checker, options.checkersDir);
  const python = options.python ?? "python3";
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: options.timeoutMs ?? 30_000,
      env: checkerEnv(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        reject(
          new Error(
            `checker ${request.checker} exited ${code} without a JSON response: ${stderr.trim() || stdout.trim()}`,
          ),
        );
        return;
      }
      const result = checkerResponse.safeParse(parsed);
      if (!result.success) {
        reject(
          new Error(
            `checker ${request.checker} wrote a response that fails the contract: ${result.error.message}`,
          ),
        );
        return;
      }
      resolve(result.data);
    });
    child.stdin.on("error", reject);
    child.stdin.end(JSON.stringify(request));
  });
}
