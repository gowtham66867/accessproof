import assert from "node:assert/strict";
import { demoSearch } from "../lib/demo";
import { evidenceStatus, type Venue } from "../lib/evidence";
const origin = process.env.ACCESSPROOF_TEST_ORIGIN || "http://127.0.0.1:3000";
let cookie = "";
async function request(path: string, body?: unknown, originHeader = origin) {
  return fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: originHeader,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(45000),
  });
}
if (process.env.ACCESSPROOF_DEMO_PASSWORD) {
  const before = await request("/api/agent", {
    venue: demoSearch().venues[1],
    requirement: "restroom",
    mode: "demo",
  });
  assert.equal(before.status, 401);
  const login = await request("/api/session", {
    password: process.env.ACCESSPROOF_DEMO_PASSWORD,
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
}
const demo = {
  venue: demoSearch().venues[1],
  requirement: "restroom",
  mode: "demo",
};
assert.equal(
  (await request("/api/agent", demo, "https://untrusted.example")).status,
  403,
);
const fixtureResponse = await request("/api/agent", demo);
assert.equal(fixtureResponse.status, 200);
const fixture = await fixtureResponse.json();
assert.equal(fixture.callsUsed, 2);
assert.equal(fixture.clues.length, 2);
assert.equal(fixture.trace.at(-1).tool, "human_checkpoint");
const venuesResponse = await request(
  "/api/venues?mode=live&q=caf%C3%A9s&location=Indiranagar%2C%20Bengaluru",
);
assert.equal(venuesResponse.status, 200);
const venues = (await venuesResponse.json()).venues as Venue[];
const venue = venues.find((v) => !v.evidence.restroom.length) || venues[0];
assert.ok(venue);
const before = evidenceStatus(venue.evidence.restroom);
const input = {
  venue,
  requirement: "restroom",
  mode: "live",
  needsDetails: true,
};
const response = await request("/api/agent", input);
const result = await response.json();
assert.equal(response.status, 200);
assert.ok(result.callsUsed > 0 && result.callsUsed <= 2);
assert.equal(result.policy, "bounded-tool-agent");
assert.equal(result.provider, "tavily");
assert.ok(result.receipt);
assert.equal(result.brief.findings.length, result.clues.length);
assert.ok(result.brief.unanswered.length > 0);
for (const finding of result.brief.findings) assert.equal(finding.text, result.clues[finding.citation - 1].excerpt);
assert.equal(result.trace.some((s: { observation: string }) => s.observation.includes("Provider unavailable")), false);
assert.equal(result.statusBefore, before);
assert.ok(result.draftQuestion.length <= 1150);
assert.equal(result.trace.at(-1).tool, "human_checkpoint");
assert.equal(evidenceStatus(venue.evidence.restroom), before);
const repeated = await request("/api/agent", input);
assert.equal(repeated.headers.get("X-AccessProof-Agent-Cache"), "hit");
const cached = await repeated.json();
assert.equal(cached.id, result.id);
assert.equal(cached.reused, true);
console.log(
  JSON.stringify({
    passed: true,
    provider: result.provider,
    venue: venue.name,
    callsUsed: result.callsUsed,
    clueCount: result.clues.length,
    sourceDomains: result.clues.map((c: { domain: string }) => c.domain),
    actions: result.trace.map((s: { action: string }) => s.action),
    statusUnchanged: before,
    cachedRunReused: cached.reused,
  }),
);
