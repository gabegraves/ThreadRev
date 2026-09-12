/**
 * Grounded web search, surface-agnostic.
 *
 * Each surface wraps this in its own tool mechanism — `defineChannelTool` for
 * Channels, a server tool for the web app — so the implementation lives in one
 * place and the binding lives at the edge.
 */
import { Exa } from "exa-js";
import { searchWebParameters, type SearchHit, type SearchWebArgs } from "../schemas";

export function isSearchConfigured(): boolean {
  return Boolean(process.env.EXA_API_KEY);
}

export async function searchWeb(args: SearchWebArgs): Promise<SearchHit[] | string> {
  const { query, results } = searchWebParameters.parse(args);
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return "Web search is not configured on this deployment (no EXA_API_KEY). Say so rather than guessing.";
  }

  const exa = new Exa(apiKey);
  const response = await exa.search(query, {
    contents: { highlights: true },
    ...(results === undefined ? {} : { numResults: results }),
  });

  return response.results.map((hit) => ({
    title: hit.title ?? hit.url,
    url: hit.url,
    published: hit.publishedDate ?? undefined,
    highlight: hit.highlights?.join("\n"),
  }));
}
