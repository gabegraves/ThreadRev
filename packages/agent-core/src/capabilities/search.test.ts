import assert from "node:assert/strict";
import { test } from "node:test";

test("Exa search request, evidence mapping, validation, and failures", async (t) => {
  const originalKey = process.env.EXA_API_KEY;
  t.after(() => {
    if (originalKey === undefined) delete process.env.EXA_API_KEY;
    else process.env.EXA_API_KEY = originalKey;
  });
  process.env.EXA_API_KEY = "test-exa-key";
  // Exa captures fetch on import; intercept it before loading the capability.
  const request = t.mock.method(globalThis, "fetch", async () => Response.json({
    results: [{
      url: "https://example.com/reference",
      publishedDate: "2026-09-12",
      highlights: ["First excerpt", "Second excerpt"],
    }],
  }));
  const { searchWeb, isSearchConfigured } = await import("./search");

  assert.equal(isSearchConfigured(), true);
  assert.deepEqual(await searchWeb({ query: " public documentation " }), [{
    title: "https://example.com/reference",
    url: "https://example.com/reference",
    published: "2026-09-12",
    highlight: "First excerpt\nSecond excerpt",
  }]);
  const [url, options] = request.mock.calls[0]!.arguments;
  assert.equal(url, "https://api.exa.ai/search");
  assert.equal(options?.method, "POST");
  assert.equal(new Headers(options?.headers).get("x-api-key"), "test-exa-key");
  assert.deepEqual(JSON.parse(String(options?.body)), {
    query: "public documentation",
    contents: { highlights: true },
  });

  await searchWeb({ query: "public documentation", results: 3 });
  assert.deepEqual(JSON.parse(String(request.mock.calls[1]!.arguments[1]?.body)), {
    query: "public documentation",
    contents: { highlights: true },
    numResults: 3,
  });
  for (const args of [
    { query: "   " },
    { query: "reference", results: 0 },
    { query: "reference", results: 11 },
    { query: "reference", results: 1.5 },
  ]) {
    await assert.rejects(searchWeb(args), { name: "ZodError" });
  }
  assert.equal(request.mock.callCount(), 2);

  request.mock.mockImplementation(async () => Response.json({ results: [] }));
  assert.deepEqual(await searchWeb({ query: "no matches" }), []);

  request.mock.mockImplementation(async () => Response.json(
    { error: "Unauthorized" }, { status: 401 },
  ));
  await assert.rejects(searchWeb({ query: "reference" }), /Unauthorized/);

  delete process.env.EXA_API_KEY;
  assert.equal(isSearchConfigured(), false);
  assert.match(String(await searchWeb({ query: "reference" })), /not configured/);
  assert.equal(request.mock.callCount(), 4);
});
