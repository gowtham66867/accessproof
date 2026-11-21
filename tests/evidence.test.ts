import test from "node:test";
import assert from "node:assert/strict";
import {
  evidenceStatus,
  extractEvidence,
  supportedCount,
} from "../lib/evidence";
import { searchVenues } from "../lib/serpapi";
import { demoSearch } from "../lib/demo";

const now = "2026-11-21T09:00:00Z";
test("missing information stays unknown, regardless of venue rating", () => {
  const evidence = extractEvidence(
    {
      rating: 5,
      extensions: [{ accessibility: ["Wheelchair accessible parking lot"] }],
    },
    now,
  );
  assert.equal(evidenceStatus(evidence.entrance), "unknown");
  assert.equal(evidenceStatus(evidence.seating), "unknown");
});
test("explicit unavailable attributes and contradictions are preserved", () => {
  const evidence = extractEvidence(
    {
      extensions: [{ accessibility: ["Wheelchair accessible entrance"] }],
      unsupported_extensions: [
        {
          accessibility: [
            "Wheelchair accessible entrance",
            "Wheelchair accessible restroom",
          ],
        },
      ],
    },
    now,
  );
  assert.equal(evidenceStatus(evidence.entrance), "conflicting");
  assert.equal(evidenceStatus(evidence.restroom), "unsupported");
  assert.equal(evidence.entrance[0].excerpt, "Wheelchair accessible entrance");
  assert.equal(evidence.entrance[0].retrievedAt, now);
  assert.equal(evidence.entrance[0].publishedAt, undefined);
});
test("demo includes all four states and counts only supported requirements", () => {
  const demo = demoSearch();
  const states = new Set(
    demo.venues.flatMap((v) => Object.values(v.evidence).map(evidenceStatus)),
  );
  assert.deepEqual([...states].sort(), [
    "conflicting",
    "supported",
    "unknown",
    "unsupported",
  ]);
  assert.equal(
    supportedCount(demo.venues[0], ["entrance", "seating", "restroom"]),
    3,
  );
  assert.equal(supportedCount(demo.venues[2], ["entrance", "seating"]), 1);
});
test("live search bounds provider requests and fetches details using place IDs", async () => {
  const calls: URL[] = [];
  const request = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.searchParams.has("q"))
      return Response.json({
        local_results: Array.from({ length: 9 }, (_, i) => ({
          title: `Venue ${i}`,
          place_id: `place-${i}`,
        })),
      });
    return Response.json({
      place_results: {
        title: "Place detail",
        extensions: [{ accessibility: ["Wheelchair accessible entrance"] }],
      },
    });
  }) as typeof fetch;
  const result = await searchVenues(
    "cafés",
    "Bengaluru",
    "secret-test-key",
    request,
  );
  assert.equal(calls.length, 6);
  assert.equal(result.venues.length, 5);
  assert.equal(calls[1].searchParams.get("place_id"), "place-0");
  assert.equal(evidenceStatus(result.venues[0].evidence.entrance), "supported");
  assert.equal(JSON.stringify(result).includes("secret-test-key"), false);
});
test("failed details retain discovered venues and report incomplete evidence", async () => {
  const request = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    return url.searchParams.has("q")
      ? Response.json({
          local_results: [{ title: "Known venue", place_id: "place-1" }],
        })
      : Response.json({ error: "secret-test-key" }, { status: 429 });
  }) as typeof fetch;
  const result = await searchVenues(
    "cafés",
    "Bengaluru",
    "secret-test-key",
    request,
  );
  assert.equal(result.venues[0].name, "Known venue");
  assert.equal(evidenceStatus(result.venues[0].evidence.entrance), "unknown");
  assert.ok(result.warnings.length);
  assert.ok(result.venues[0].warning);
});
test("empty searches return an empty result and provider failures reject safely", async () => {
  const empty = await searchVenues("cafés", "Bengaluru", "secret", (async () =>
    Response.json({ local_results: [] })) as typeof fetch);
  assert.equal(empty.venues.length, 0);
  await assert.rejects(
    searchVenues("cafés", "Bengaluru", "secret", (async () =>
      Response.json({ error: "secret" })) as typeof fetch),
    /provider returned an error/,
  );
});
