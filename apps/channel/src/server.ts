/**
 * There is no `channel.start()`. Attaching the Channel to a CopilotRuntime and
 * creating the listener is what starts it — which is why teardown is wired
 * before the listener exists.
 */
import { createServer } from "node:http";
import { CopilotKitIntelligence, CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";
import { channel } from "./channel";
import { required } from "./env";

const intelligence = new CopilotKitIntelligence({
  apiKey: required("INTELLIGENCE_API_KEY"),
  // Hosted Intelligence supplies both defaults. Override both together only for
  // self-hosted — they are separate hosts, so never derive one from the other.
  apiUrl: process.env.INTELLIGENCE_API_URL,
  wsUrl: process.env.INTELLIGENCE_GATEWAY_WS_URL,
});

const runtime = new CopilotRuntime({
  agents: {}, // required even though the Channel supplies the agent
  intelligence,
  channels: [channel],
});

let teardown: (() => Promise<void>) | undefined;
let shuttingDown = false;

const shutdown = async (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await teardown?.();
  } catch (e) {
    console.error("  teardown failed:", (e as Error).message);
  }
  process.exit(code);
};
process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

/**
 * A listener has to outlive one bad turn.
 *
 * Node terminates the process on an unhandled rejection, so a promise that
 * rejects anywhere in one thread's review — a Slack write that 429s, a tool
 * that throws past its own catch — takes down every other channel with it and
 * leaves the bot silently offline. Log it loudly and stay up: one failed review
 * is recoverable, a dead listener during a live thread is not.
 */
process.on("unhandledRejection", (reason) => {
  console.error(
    "  [unhandled rejection] the run that caused this failed; the listener is still up:",
    reason instanceof Error ? reason.stack : reason,
  );
});

/**
 * An uncaught exception is different: the process state is no longer
 * trustworthy, so stay down rather than serve from it. Shut down cleanly so the
 * Channel disconnects instead of dangling.
 */
process.on("uncaughtException", (error) => {
  console.error("  [uncaught exception] shutting down:", error.stack ?? error);
  void shutdown(1);
});

const listener = createCopilotNodeListener({ runtime, basePath: "/api/copilotkit" });
const channels = listener.channels;
const server = createServer(listener);

teardown = async () => {
  await channels.stop();
  if (server.listening) server.close();
};

await channels.ready({ timeoutMs: 30_000 });

// `ready()` is NOT proof of life — it resolves on `setup_required` too, because
// a declared-but-unprovisioned Channel counts as a valid degraded state. Skip
// this check and you get a process that boots cleanly, serves 200s, and answers
// nothing.
const status = channels.status();
if (status.overall !== "online") {
  console.error(
    `\n  Channel is not online: ${JSON.stringify(status)}\n` +
      `  → 'setup_required' means the provider side is unfinished. Run: npm run channel:status\n` +
      `  → See dev-docs/troubleshooting.md\n`,
  );
  await teardown();
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `
  Port ${port} is already in use — something else is listening there.
` +
        `  → Stop it, or start this with PORT=<other> npm run dev:slack
`,
    );
  } else {
    console.error(`
  Server failed to start: ${error.message}
`);
  }
  void shutdown(1);
});

server.listen(port, () => {
  console.log(`\n  ✓ Channel "${process.env.CHANNEL_CODE}" online — listening on :${port}`);
  console.log(`    Invite the bot to a channel (/invite @Rev), then @-mention it.\n`);
});
