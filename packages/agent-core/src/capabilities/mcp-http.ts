/**
 * The smallest MCP client that can call one tool over Streamable HTTP.
 *
 * Why not the SDK: `@modelcontextprotocol/sdk` is a dependency of apps/web and
 * of neither package that needs this, and adding it means a package-lock change
 * while four people are pushing. The surface actually required here is three
 * JSON-RPC calls — initialize, tools/list, tools/call — so it is cheaper to
 * speak the protocol than to take the dependency.
 *
 * Deliberately not a general client. No SSE streaming beyond reading the first
 * event, no subscriptions, no resources, no reconnection. If this grows past
 * filing a follow-up, take the SDK instead.
 */

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
}

export interface McpCallResult {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

interface JsonRpcResponse {
  result?: unknown;
  error?: { code: number; message: string };
}

export interface McpHttpOptions {
  url: string;
  apiKey: string;
  /** Client name reported at initialize. Shows up in the server's logs. */
  client?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class McpHttpError extends Error {}

/**
 * One request/response pair.
 *
 * A Streamable HTTP server may answer with either `application/json` or an SSE
 * stream whose first `data:` line carries the response, so both are read. A
 * notification (no id) gets no body back and is not waited on.
 */
async function rpc(
  options: McpHttpOptions,
  sessionId: string | undefined,
  method: string,
  params: unknown,
  id?: number,
): Promise<{ response?: JsonRpcResponse; sessionId?: string }> {
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  try {
    const res = await doFetch(options.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        // Both, because the server picks.
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${options.apiKey}`,
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify(
        id === undefined ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id, method, params },
      ),
    });

    const nextSession = res.headers.get("mcp-session-id") ?? sessionId;
    if (!res.ok) {
      throw new McpHttpError(`${method} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    // Notifications get no response body worth reading.
    if (id === undefined) return { sessionId: nextSession ?? undefined };

    const body = await res.text();
    const payload = (res.headers.get("content-type") ?? "").includes("text/event-stream")
      ? firstSseData(body)
      : body;
    if (!payload) throw new McpHttpError(`${method} returned an empty response`);

    let parsed: JsonRpcResponse;
    try {
      parsed = JSON.parse(payload) as JsonRpcResponse;
    } catch {
      throw new McpHttpError(`${method} returned unparseable JSON: ${payload.slice(0, 200)}`);
    }
    if (parsed.error) throw new McpHttpError(`${method} failed: ${parsed.error.message}`);
    return { response: parsed, sessionId: nextSession ?? undefined };
  } finally {
    clearTimeout(timer);
  }
}

/** The JSON on the first `data:` line of an SSE body. */
export function firstSseData(body: string): string | undefined {
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith("data:")) return line.slice(5).trim();
  }
  return undefined;
}

/**
 * A connected session. Created by `connect`, which performs the handshake so
 * callers never see a half-initialised one.
 */
export interface McpSession {
  listTools(): Promise<McpToolInfo[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult>;
}

export async function connect(options: McpHttpOptions): Promise<McpSession> {
  const init = await rpc(options, undefined, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: options.client ?? "threadrev", version: "1" },
  }, 1);
  const sessionId = init.sessionId;

  // Required by the protocol before any other call; servers that do not need
  // it ignore it.
  await rpc(options, sessionId, "notifications/initialized", {});

  let nextId = 2;
  return {
    async listTools() {
      const { response } = await rpc(options, sessionId, "tools/list", {}, nextId++);
      const tools = (response?.result as { tools?: McpToolInfo[] } | undefined)?.tools;
      return Array.isArray(tools) ? tools : [];
    },
    async callTool(name, args) {
      const { response } = await rpc(options, sessionId, "tools/call", { name, arguments: args }, nextId++);
      const result = (response?.result ?? {}) as McpCallResult;
      if (result.isError) {
        const text = result.content?.map((c) => c.text ?? "").join(" ").trim();
        throw new McpHttpError(`${name} reported an error: ${text || "no detail"}`);
      }
      return result;
    },
  };
}
