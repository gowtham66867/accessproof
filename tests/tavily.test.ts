import test from "node:test";
import assert from "node:assert/strict";
import { searchTavilySources } from "../lib/tavily";
import { runResearchAgent } from "../lib/agent";
import { demoSearch } from "../lib/demo";
import { evidenceStatus } from "../lib/evidence";

test("Tavily uses bearer POST, explicit basic budget, bounded results and no generated answer", async () => {
  let seen: RequestInit | undefined;
  const hits = await searchTavilySources("Juniper Indiranagar toilet", "test-secret", async (url, init) => {
    assert.equal(url, "https://api.tavily.com/search");
    seen = init;
    return Response.json({ results: Array.from({ length: 12 }, (_, i) => ({ title: `Source ${i}`, url: `https://example.org/${i}`, content: "Public source excerpt" })) });
  });
  assert.equal(seen?.method, "POST");
  assert.equal((seen?.headers as Record<string, string>).Authorization, "Bearer test-secret");
  const body = JSON.parse(String(seen?.body));
  assert.equal(body.search_depth, "basic");
  assert.equal(body.auto_parameters, false);
  assert.equal(body.include_answer, false);
  assert.equal(body.include_raw_content, false);
  assert.equal(body.max_results, 8);
  assert.equal(hits.length, 8);
  assert.equal(hits[0].snippet, "Public source excerpt");
  assert.equal(JSON.stringify(hits).includes("test-secret"), false);
});

test("Tavily provider rejection never includes its secret or response body", async () => {
  await assert.rejects(searchTavilySources("q", "test-secret", async () => Response.json({ detail: "test-secret" }, { status: 401 })), { message: "Tavily research unavailable." });
  await assert.rejects(searchTavilySources("q", "", async () => { throw new Error("must not call"); }), /not configured/);
});

test("Tavily malformed results fail safely and invalid entries are discarded", async () => {
  await assert.rejects(searchTavilySources("q", "key", async () => Response.json({ error: "private-provider-message" })), /unavailable/);
  const hits = await searchTavilySources("q", "key", async () => Response.json({ results: [null, { url: "https://example.org", title: 12, content: "x" }, { url: "https://example.org", title: "Valid", content: "x" }] }));
  assert.equal(hits.length, 1);
});

test("Tavily research produces cited clues and stops for human review without changing evidence", async () => {
  const venue = demoSearch().venues[1];
  const before = structuredClone(venue.evidence);
  const result = await runResearchAgent({ venue, mode: "live", requirement: "restroom" }, (q) => searchTavilySources(q, "key", async () => Response.json({ results: [
    { title: "Juniper Coffee House Indiranagar", url: "https://example.org/access", content: "Juniper Coffee House Indiranagar wheelchair access and toilet details need confirmation." },
    { title: "Juniper Coffee House Indiranagar", url: "https://example.com/access", content: "Juniper Coffee House Indiranagar wheelchair entrance and toilet route." },
  ] })));
  assert.equal(result.provider, "tavily");
  assert.equal(result.callsUsed, 1);
  assert.equal(result.clues.length, 2);
  assert.match(result.draftQuestion, /Tavily search/);
  assert.match(result.draftQuestion, /https:\/\/example.org\/access/);
  assert.equal(result.trace.at(-1)?.tool, "human_checkpoint");
  assert.deepEqual(venue.evidence, before);
  assert.equal(evidenceStatus(venue.evidence.restroom), "unknown");
});
