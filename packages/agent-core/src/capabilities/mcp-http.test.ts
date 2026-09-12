import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { connect, firstSseData, McpHttpError } from "./mcp-http";

/**
 * A real HTTP server speaking the slice of MCP this client uses.
 *
 * The client cannot be pointed at Ambiguous in a test — there is no key, and a
 * test that needs one is a test nobody runs. Standing up the protocol locally
 * exercises the handshake, the session header, the auth header and both
 * response encodings, which is everything that can be wrong on our side.
 */
interface Recorded {
  method: string;
  auth?: string;
  session?: string;
  params?: unknown;
}

async function withServer(
  handle: (method: string, params: unknown) => { result?: unknown; error?: { code: number; message: string } },
  opts: { sse?: boolean; session?: string; status?: number } = {},
) {
  const seen: Recorded[] = [];
  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const msg = JSON.parse(body) as { id?: number; method: string; params?: unknown };
      seen.push({
        method: msg.method,
        auth: req.headers.authorization,
        session: req.headers["mcp-session-id"] as string | undefined,
        params: msg.params,
      });
      const headers: Record<string, string> = {};
      if (opts.session) headers["mcp-session-id"] = opts.session;
      if (opts.status && msg.method === "tools/call") {
        res.writeHead(opts.status, headers);
        res.end("upstream said no");
        return;
      }
      // A notification has no id and expects no body.
      if (msg.id === undefined) {
        res.writeHead(202, headers);
        res.end();
        return;
      }
      const payload = JSON.stringify({ jsonrpc: "2.0", id: msg.id, ...handle(msg.method, msg.params) });
      if (opts.sse) {
        res.writeHead(200, { ...headers, "content-type": "text/event-stream" });
        res.end(`event: message\ndata: ${payload}\n\n`);
      } else {
        res.writeHead(200, { ...headers, "content-type": "application/json" });
        res.end(payload);
      }
    });
  });
  server.listen(0);
  await once(server, "listening");
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}/mcp`, seen, close: () => server.close() };
}

const ok = (method: string) => {
  if (method === "initialize") return { result: { protocolVersion: "2025-06-18", capabilities: {} } };
  if (method === "tools/list") return { result: { tools: [{ name: "tasks_create", description: "Create a task" }] } };
  if (method === "tools/call") return { result: { content: [{ type: "text", text: "task-123 created" }] } };
  return { error: { code: -32601, message: `no such method ${method}` } };
};

test("handshake, auth and session survive a whole exchange", async () => {
  const s = await withServer(ok, { session: "sess-abc" });
  try {
    const session = await connect({ url: s.url, apiKey: "secret-key" });
    const tools = await session.listTools();
    assert.deepEqual(tools.map((t) => t.name), ["tasks_create"]);

    const result = await session.callTool("tasks_create", { title: "Follow up" });
    assert.match(result.content?.[0]?.text ?? "", /task-123/);

    // initialize, notifications/initialized, tools/list, tools/call
    assert.deepEqual(s.seen.map((r) => r.method), [
      "initialize",
      "notifications/initialized",
      "tools/list",
      "tools/call",
    ]);
    assert.ok(s.seen.every((r) => r.auth === "Bearer secret-key"), "every call must carry the key");
    // The session id the server handed back is echoed on everything after it.
    assert.equal(s.seen[0]!.session, undefined, "nothing to echo on the first call");
    assert.ok(s.seen.slice(1).every((r) => r.session === "sess-abc"));
  } finally {
    s.close();
  }
});

test("a server that answers over SSE is read the same way", async () => {
  const s = await withServer(ok, { sse: true });
  try {
    const session = await connect({ url: s.url, apiKey: "k" });
    const tools = await session.listTools();
    assert.deepEqual(tools.map((t) => t.name), ["tasks_create"]);
  } finally {
    s.close();
  }
});

test("a JSON-RPC error becomes an error here, not a silent empty result", async () => {
  const s = await withServer((method) =>
    method === "tools/call" ? { error: { code: -32000, message: "scope missing: tasks.write" } } : ok(method),
  );
  try {
    const session = await connect({ url: s.url, apiKey: "k" });
    await assert.rejects(
      () => session.callTool("tasks_create", {}),
      (e: Error) => e instanceof McpHttpError && /scope missing/.test(e.message),
    );
  } finally {
    s.close();
  }
});

test("an HTTP failure names the status rather than throwing a parse error", async () => {
  const s = await withServer(ok, { status: 403 });
  try {
    const session = await connect({ url: s.url, apiKey: "k" });
    await assert.rejects(
      () => session.callTool("tasks_create", {}),
      (e: Error) => e instanceof McpHttpError && /HTTP 403/.test(e.message),
    );
  } finally {
    s.close();
  }
});

test("a tool reporting isError is a failure, not a result to act on", async () => {
  const s = await withServer((method) =>
    method === "tools/call"
      ? { result: { isError: true, content: [{ type: "text", text: "title is required" }] } }
      : ok(method),
  );
  try {
    const session = await connect({ url: s.url, apiKey: "k" });
    await assert.rejects(
      () => session.callTool("tasks_create", {}),
      (e: Error) => /title is required/.test(e.message),
    );
  } finally {
    s.close();
  }
});

test("the first SSE data line is the response", () => {
  assert.equal(firstSseData("event: message\ndata: {\"ok\":1}\n\n"), '{"ok":1}');
  assert.equal(firstSseData("retry: 500\n\n"), undefined);
});
