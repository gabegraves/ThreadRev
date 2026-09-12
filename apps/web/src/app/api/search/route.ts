/**
 * Server-side search for the voice agent.
 *
 * The voice agent's tools execute in the browser, so they cannot read
 * EXA_API_KEY. This route keeps the key server-side and exposes the same
 * `searchWeb` capability the Slack and web surfaces use.
 */
import { searchWeb, searchWebParameters } from "agent-core";

export async function POST(request: Request) {
  const parsed = searchWebParameters.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "A non-empty query and optional result count from 1 to 10 are required." }, { status: 400 });
  }
  return Response.json({ results: await searchWeb(parsed.data) });
}
